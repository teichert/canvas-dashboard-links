const navigateToRelativeLink = () => window.location.href = window.location.origin + window.location.pathname + "/external_tools/3809";
const extractCourseLinks = () => [...document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link')].map(a => a.href);
const setPageTitle = (title) => document.title = title;
const combineTitles = (courseTitle, pageTitle) => `${courseTitle} - ${pageTitle}`;
const runOnTab = async (tabId, extractor, args) => (await chrome.scripting.executeScript({ target: { tabId }, func: extractor, args }));
const extractFromTab = async (tabId, extractor, args) => (await runOnTab(tabId, extractor, args))?.[0]?.result;
const makeListenerWithState = (handler, state) => { const self = (tabId, info) => handler(tabId, info, state, self); return self; };

async function runOnTabAfterLoaded(tabId, info, state, self, func, args) {
    if (tabId !== state.targetTabId || info?.status !== 'complete') return null;
    chrome.tabs.onUpdated.removeListener(self);
    const tab = await chrome.tabs.get(tabId);
    await runOnTab(tabId, func, args);
    return tab;
}

async function captureTitleAndNavigate(tabId, info, state, self) {
    const tab = await runOnTabAfterLoaded(tabId, info, state, self, navigateToRelativeLink);
    if (!tab) return;
    chrome.tabs.onUpdated.addListener(makeListenerWithState(setCombinedTitle, { 
        targetTabId: state.targetTabId, 
        courseTitle: tab.title 
    }));
}

async function setCombinedTitle(tabId, info, state, self) {
    if (tabId !== state.targetTabId || info?.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(self);
    const tab = await chrome.tabs.get(tabId);
    await runOnTab(tabId, setPageTitle, [combineTitles(state.courseTitle, tab.title)]);
}

async function createCourseTab(windowId, url) {
    const tab = await chrome.tabs.create({ windowId, url, active: false });
    chrome.tabs.onUpdated.addListener(makeListenerWithState(captureTitleAndNavigate, { targetTabId: tab.id }));
}

function openCourseTabsWhenLinksReady(dashboardTabId, windowId, pollIntervalMs = 500) {
    const interval = setInterval(async () => {
        const courseLinks = await extractFromTab(dashboardTabId, extractCourseLinks);
        if (!courseLinks?.length) return;
        clearInterval(interval);
        courseLinks.forEach(url => createCourseTab(windowId, url));
    }, pollIntervalMs);
    chrome.windows.onRemoved.addListener(function cleanup(closedWindowId) {
        if (closedWindowId === windowId) {
            clearInterval(interval);
            chrome.windows.onRemoved.removeListener(cleanup);
        }
    });
}

chrome.action.onClicked.addListener(async () => {
    const window = await chrome.windows.create({ url: "https://snow.instructure.com/", focused: true });
    const tabs = await chrome.tabs.query({ windowId: window.id });
    openCourseTabsWhenLinksReady(tabs[0].id, window.id);
});
