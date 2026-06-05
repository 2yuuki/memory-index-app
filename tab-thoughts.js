/**
 * The Memory Index - Tab 1: Thoughts
 * Logic that is specific to Tab 1 goes here.
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnCreateCard = document.getElementById('btnCreateCard');
    const inpThought = document.getElementById('inpThought');
    const thoughtCardHtml = document.getElementById('thought-card-html');
    const thoughtCardTextContent = document.getElementById('thought-card-text-content');
    const thoughtCardDate = document.getElementById('thought-card-date');

    // Container ẩn để render card bằng html2canvas mà không làm giật UI
    let renderContainer = document.getElementById('render-container');
    if (!renderContainer) {
        renderContainer = document.createElement('div');
        renderContainer.id = 'render-container';
        renderContainer.style.position = 'absolute';
        renderContainer.style.top = '-9999px';
        renderContainer.style.left = '-9999px';
        document.body.appendChild(renderContainer);
    }

    if (btnCreateCard && inpThought && thoughtCardHtml) {
        btnCreateCard.addEventListener('click', () => {
            const text = inpThought.value.trim();
            if (!text) {
                if (window.showToast) window.showToast("Please write something first!");
                return;
            }

            if (thoughtCardTextContent) thoughtCardTextContent.innerText = text;
            if (thoughtCardDate) {
                const now = new Date();
                thoughtCardDate.innerText = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
            }

            const cloneCard = thoughtCardHtml.cloneNode(true);
            cloneCard.style.display = 'block';
            renderContainer.innerHTML = '';
            renderContainer.appendChild(cloneCard);

            if (window.html2canvas) {
                html2canvas(cloneCard, {
                    backgroundColor: '#ffffff',
                    scale: 2 // Xuất ảnh sắc nét
                }).then(canvas => {
                    if (window.addToLibrary) {
                        window.addToLibrary(canvas, 'Thought_' + Date.now(), { text: text });
                    }
                    inpThought.value = ''; 
                    renderContainer.innerHTML = '';
                }).catch(err => {
                    console.error("Failed to create thought card:", err);
                    renderContainer.innerHTML = '';
                });
            } else {
                console.error("html2canvas is not loaded!");
            }
        });
    }
});