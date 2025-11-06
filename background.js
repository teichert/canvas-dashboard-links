const extractCourseLinks = () => [...document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link')].map(a => a.href);
const navigateToRelativeLink = () => window.location.href = window.location.href + "/external_tools/3809";
const setPageTitle = (title) => document.title = title;
const combineTitles = (courseTitle, pageTitle) => `${courseTitle} - ${pageTitle}`;
const extractFromTab = async (tabId, extractor, args) => (await chrome.scripting.executeScript({ target: { tabId }, func: extractor, args }))?.[0]?.result;
const makeSelfReferencing = (factory) => (self => self = factory(self))();
const createStatefulListener = (handler, state) => makeSelfReferencing(self => (tabId, info) => handler(tabId, info, state, self));

async function navigateWithTitleOrSetCombinedTitle(tabId, courseTitle = null) {
    const tab = await chrome.tabs.get(tabId);
    
    if (!courseTitle) {
        await extractFromTab(tabId, navigateToRelativeLink);
        return tab.title;
    }
    
    await extractFromTab(tabId, setPageTitle, [combineTitles(courseTitle, tab.title)]);
}

async function navigateOnLoad(updatedTabId, info, state, listener) {
    if (updatedTabId !== state.targetTabId || info.status !== 'complete') return;
    
    state.loadCount++;
    console.log(`Tab ${updatedTabId} load ${state.loadCount}, title: ${info.title}`);
    
    if (state.loadCount > 5) {
        console.error(`Tab ${updatedTabId} exceeded max loads, removing listener`);
        chrome.tabs.onUpdated.removeListener(listener);
        return;
    }
    
    if (state.loadCount === 1) {
        const tab = await chrome.tabs.get(updatedTabId);
        state.courseTitle = tab.title;
        console.log(`Saved course title: ${state.courseTitle}`);
        await chrome.scripting.executeScript({
            target: { tabId: updatedTabId },
            func: navigateToRelativeLink
        });
    } else if (state.loadCount === 2) {
        chrome.tabs.onUpdated.removeListener(listener);
        const tab = await chrome.tabs.get(updatedTabId);
        const combinedTitle = combineTitles(state.courseTitle, tab.title);
        console.log(`Setting combined title: ${combinedTitle} (course: ${state.courseTitle}, page: ${tab.title})`);
        await chrome.scripting.executeScript({
            target: { tabId: updatedTabId },
            func: setPageTitle,
            args: [combinedTitle]
        });
    }
}

async function createCourseTab(windowId, url) {
    const tab = await chrome.tabs.create({ windowId, url });
    const state = { targetTabId: tab.id, courseTitle: '', loadCount: 0 };
    chrome.tabs.onUpdated.addListener(createStatefulListener(navigateOnLoad, state));
}

function openCourseTabsWhenLinksReady(dashboardTabId, windowId, pollIntervalMs = 1500) {
    const interval = setInterval(async () => {
        const courseLinks = await extractFromTab(dashboardTabId, extractCourseLinks);
        if (!courseLinks?.length) return;
        clearInterval(interval);
        courseLinks.forEach(url => createCourseTab(windowId, url));
    }, pollIntervalMs);
}

chrome.action.onClicked.addListener(async () => {
    const win = await chrome.windows.create({ url: "https://snow.instructure.com/", focused: true });
    const tabs = await chrome.tabs.query({ windowId: win.id });
    openCourseTabsWhenLinksReady(tabs[0].id, win.id);
});
