const getRelativeUrl = () => new URLSearchParams(window.location.search).get('url') || '';
const navigateToRelativeLink = (relativeUrl) => window.location.href = window.location.origin + window.location.pathname + relativeUrl;
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
    const tab = await runOnTabAfterLoaded(tabId, info, state, self, navigateToRelativeLink, [state.relativeUrl]);
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

async function createCourseTab(windowId, url, relativeUrl) {
    const tab = await chrome.tabs.create({ windowId, url, active: false });
    chrome.tabs.onUpdated.addListener(makeListenerWithState(captureTitleAndNavigate, { targetTabId: tab.id, relativeUrl }));
}

function openCourseTabsWhenLinksReady(dashboardTabId, windowId, relativeUrl, pollIntervalMs = 500) {
    const interval = setInterval(async () => {
        const courseLinks = await extractFromTab(dashboardTabId, extractCourseLinks);
        if (!courseLinks?.length) return;
        clearInterval(interval);
        courseLinks.forEach(url => createCourseTab(windowId, url, relativeUrl));
    }, pollIntervalMs);
    chrome.windows.onRemoved.addListener(function cleanup(closedWindowId) {
        if (closedWindowId === windowId) {
            clearInterval(interval);
            chrome.windows.onRemoved.removeListener(cleanup);
        }
    });
}

(async () => {
    const relativeUrl = getRelativeUrl();
    const window = await chrome.windows.create({ url: "https://snow.instructure.com/", focused: true });
    const tabs = await chrome.tabs.query({ windowId: window.id });
    openCourseTabsWhenLinksReady(tabs[0].id, window.id, relativeUrl);
})();
