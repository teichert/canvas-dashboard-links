const extensionId = chrome.runtime.id;
const baseUrl = `chrome-extension://${extensionId}/canvas-relative.html`;

const customTitle = document.getElementById('customTitle');
const customPath = document.getElementById('customPath');
const customLink = document.getElementById('customLink');

const updateCustomLink = () => {
    const title = customTitle.value.trim() || 'Custom Link';
    const path = customPath.value.trim();
    
    customLink.textContent = title;
    customLink.href = path ? `${baseUrl}?url=${path}` : baseUrl;
};

customTitle.addEventListener('input', updateCustomLink);
customPath.addEventListener('input', updateCustomLink);
updateCustomLink();

// Make all links work in popup by opening in new tab
document.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: link.href });
    });
});
