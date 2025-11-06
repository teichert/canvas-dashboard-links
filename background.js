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
                                chrome.tabs.create({ windowId, url: url }, (tab) => {
                                    let courseTitle = '';
                                    let loadCount = 0;
                                    
                                    // Wait for the tab to load to get the course name
                                    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                                        if (tabId === tab.id && info.status === 'complete') {
                                            loadCount++;
                                            
                                            if (loadCount === 1) {
                                                // First load - got the course name
                                                chrome.tabs.get(tabId, (updatedTab) => {
                                                    courseTitle = updatedTab.title;
                                                    // Navigate to the relative link
                                                    chrome.scripting.executeScript({
                                                        target: { tabId: tabId },
                                                        func: () => {
                                                            window.location.href = window.location.href + "/external_tools/3809";
                                                        }
                                                    });
                                                });
                                            } else if (loadCount === 2) {
                                                // Second load - got the attendance page
                                                chrome.tabs.onUpdated.removeListener(listener);
                                                chrome.tabs.get(tabId, (updatedTab) => {
                                                    const attendanceTitle = updatedTab.title;
                                                    // Combine both titles
                                                    const combinedTitle = `${courseTitle} - ${attendanceTitle}`;
                                                    chrome.scripting.executeScript({
                                                        target: { tabId: tabId },
                                                        func: (newTitle) => {
                                                            document.title = newTitle;
                                                        },
                                                        args: [combinedTitle]
                                                    });
                                                });
                                            }
                                        }
                                    });
                                });
                            });
                    }
                });
            }, 1500); // poll every 1.5 seconds
        });
    });
});
