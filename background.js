const extractCourseLinks = () => [...document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link')].map(a => a.href);
const navigateToRelativeLink = () => window.location.href = window.location.origin + window.location.pathname + "/external_tools/3809";
const setPageTitle = (title) => document.title = title;
const combineTitles = (courseTitle, pageTitle) => `${courseTitle} - ${pageTitle}`;
const runOnTab = async (tabId, extractor, args) => (await chrome.scripting.executeScript({ target: { tabId }, func: extractor, args }));
const extractFromTab = async (tabId, extractor, args) => (await runOnTab(tabId, extractor, args))?.[0]?.result;
const makeListenerWithState = (handler, state) => { const self = (tabId, info) => handler(tabId, info, state, self); return self; };

async function runOnTabAfterLoaded(tabId, info, state, self, func, args) {
    if (tabId !== state.targetTabId) return null;
    console.log(`Tab ${tabId} update: status=${info?.status}, url=${info?.url}`);
    if (info?.status !== 'complete') return null;
    console.log(`Removing listener for tab ${state.targetTabId}`);
    chrome.tabs.onUpdated.removeListener(self);
    const tab = await chrome.tabs.get(tabId);
    await runOnTab(tabId, func, args);
    return tab;
}

async function captureTitleAndNavigate(tabId, info, state, self) {
    const tab = await runOnTabAfterLoaded(tabId, info, state, self, navigateToRelativeLink);
    if (!tab) return;
    console.log(`Captured title: ${tab.title}, adding second listener`);
    chrome.tabs.onUpdated.addListener(makeListenerWithState(setCombinedTitle, { 
        targetTabId: state.targetTabId, 
        courseTitle: tab.title 
    }));
}

async function setCombinedTitle(tabId, info, state, self) {
    if (tabId !== state.targetTabId || info?.status !== 'complete') return;
    console.log(`Removing setCombinedTitle listener for tab ${state.targetTabId}`);
    chrome.tabs.onUpdated.removeListener(self);
    const tab = await chrome.tabs.get(tabId);
    const combined = combineTitles(state.courseTitle, tab.title);
    console.log(`Set combined title: ${combined}`);
    await runOnTab(tabId, setPageTitle, [combined]);
}

async function createCourseTab(windowId, url) {
    console.log(`Creating course tab for: ${url}`);
    const tab = await chrome.tabs.create({ windowId, url, active: false });
    console.log(`Created tab ${tab.id}`);
    chrome.tabs.onUpdated.addListener(makeListenerWithState(captureTitleAndNavigate, { targetTabId: tab.id }));
}

function openCourseTabsWhenLinksReady(dashboardTabId, windowId, pollIntervalMs = 500) {
    console.log(`Starting to poll for course links on tab ${dashboardTabId}`);
    const interval = setInterval(async () => {
        try {
            const courseLinks = await extractFromTab(dashboardTabId, extractCourseLinks);
            console.log(`Found ${courseLinks?.length || 0} course links`, courseLinks);
            if (!courseLinks?.length) return;
            clearInterval(interval);
            courseLinks.forEach(url => createCourseTab(windowId, url));
        } catch (error) {
            console.error('Error extracting course links:', error);
            clearInterval(interval);
        }
    }, pollIntervalMs);
    
    chrome.windows.onRemoved.addListener(function cleanup(closedWindowId) {
        if (closedWindowId === windowId) {
            console.log(`Window ${windowId} closed, stopping polling`);
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
