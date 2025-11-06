chrome.action.onClicked.addListener(() => {
    chrome.windows.create({ url: "https://snow.instructure.com/", focused: true }, (win) => {
        const windowId = win.id;

        chrome.tabs.query({ windowId }, (tabs) => {
            const dashboardTabId = tabs[0].id;

            const interval = setInterval(() => {
                chrome.scripting.executeScript({
                    target: { tabId: dashboardTabId },
                    func: () => {
                        const links = document.querySelectorAll('a[href*="/courses/"].ic-DashboardCard__link');
                        return Array.from(links).map(a => a.href);
                    }
                }, (results) => {
                    if (!results || !results[0] || !results[0].result) return;

                    const urls = results[0].result;
                    if (urls.length) {
                        clearInterval(interval);
                            urls.forEach(url => {
                                const newUrl = url;
                                chrome.tabs.create({ windowId, url: newUrl });
                            });
                    }
                });
            }, 1500); // poll every 1.5 seconds
        });
    });
});
