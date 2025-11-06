const extractCourseLinks = () => [...document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link')].map(a => a.href);
const navigateToRelativeLink = () => window.location.href = window.location.href + "/external_tools/3809";
const setPageTitle = (title) => document.title = title;
const combineTitles = (courseTitle, pageTitle) => `${courseTitle} - ${pageTitle}`;
const runOnTab = async (tabId, extractor, args) => (await chrome.scripting.executeScript({ target: { tabId }, func: extractor, args }));
const extractFromTab = async (tabId, extractor, args) => runOnTab(tabId, extractor, args)?.[0]?.result;
const makeSelfReferencing = (factory) => (self => self = factory(self))();
const createStatefulListener = (handler, state) => makeSelfReferencing(self => (tabId, info) => handler(tabId, info, state, self));

async function navigateToRelativeLinkOnLoad(tabId, info, state, listener) {
    if (tabId !== state.targetTabId || info.status !== 'complete') return;
    state.loadCount++;
    const tab = await chrome.tabs.get(tabId);
    if (state.loadCount === 1) {
        state.courseTitle = tab.title;
        runOnTab(tabId, navigateToRelativeLink);
    } else if (state.loadCount === 2) {
        runOnTab(tabId, setPageTitle, [combineTitles(state.courseTitle, tab.title)]);
        chrome.tabs.onUpdated.removeListener(listener);
    }
}

async function createCourseTab(windowId, url) {
    const tab = await chrome.tabs.create({ windowId, url, active: false });
    chrome.tabs.onUpdated.addListener(createStatefulListener(navigateToRelativeLinkOnLoad, { 
        targetTabId: tab.id, 
        courseTitle: '', 
        loadCount: 0 
    }));
}

function openCourseTabsWhenLinksReady(dashboardTabId, windowId, pollIntervalMs = 500) {
    setInterval(async () => {
        const courseLinks = await extractFromTab(dashboardTabId, extractCourseLinks);
        if (!courseLinks?.length) return;
        clearInterval(interval);
        courseLinks.forEach(url => createCourseTab(windowId, url));
    }, pollIntervalMs);
}

chrome.action.onClicked.addListener(async () => {
    const window = await chrome.windows.create({ url: "https://snow.instructure.com/", focused: true });
    const tabs = await chrome.tabs.query({ windowId: window.id });
    openCourseTabsWhenLinksReady(tabs[0].id, window.id);
});
