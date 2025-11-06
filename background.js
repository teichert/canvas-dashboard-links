const extractCourseLinks = () => [...document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link')].map(a => a.href);
const navigateToRelativeLink = () => window.location.href = window.location.href + "/external_tools/3809";
const setPageTitle = (title) => document.title = title;
const combineTitles = (courseTitle, pageTitle) => `${courseTitle} - ${pageTitle}`;
const executeScript = async (tabId, func, args) => chrome.scripting.executeScript({ target: { tabId }, func, args });
const createCourseTab = async (windowId, url)  => chrome.tabs.onUpdated.addListener(createTabUpdateListener((await chrome.tabs.create({ windowId, url })).id));

async function handlePageLoad(tabId, courseTitle = null) {
    const tab = await chrome.tabs.get(tabId);
    
    if (!courseTitle) {
        await executeScript(tabId, navigateToRelativeLink);
        return tab.title;
    }
    
    await executeScript(tabId, setPageTitle, [combineTitles(courseTitle, tab.title)]);
}

function createTabUpdateListener(tabId) {
    let courseTitle = '';
    let loadCount = 0;
    
    const listener = async (updatedTabId, info) => {
        if (updatedTabId !== tabId || info.status !== 'complete') return;
        
        loadCount++;
        
        if (loadCount === 1) {
            courseTitle = await handlePageLoad(tabId);
        } else if (loadCount === 2) {
            chrome.tabs.onUpdated.removeListener(listener);
            await handlePageLoad(tabId, courseTitle);
        }
    };
    
    return listener;
}

function pollForCourseLinks(dashboardTabId, windowId) {
    const interval = setInterval(async () => {
        const results = await executeScript(dashboardTabId, extractCourseLinks);
        if (!results?.[0]?.result) return;
        
        const urls = results[0].result;
        if (urls.length > 0) {
            clearInterval(interval);
            urls.forEach(url => createCourseTab(windowId, url));
        }
    }, 1500);
}

chrome.action.onClicked.addListener(async () => {
    const win = await chrome.windows.create({ url: "https://snow.instructure.com/", focused: true });
    const tabs = await chrome.tabs.query({ windowId: win.id });
    pollForCourseLinks(tabs[0].id, win.id);
});
