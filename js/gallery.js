/**
 * 画廊灯箱 — 图片全屏浏览
 * 支持键盘导航、触摸滑动
 */

const Gallery = (() => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    let currentType = '';      // 'photography' | 'design'
    let currentIndex = 0;
    let currentItems = [];     // 当前浏览列表
    let touchStartX = 0;
    let touchStartY = 0;

    /**
     * 初始化灯箱
     */
    function init() {
        // 关闭按钮
        closeBtn.addEventListener('click', close);

        // 上一张/下一张
        prevBtn.addEventListener('click', () => navigate(-1));
        nextBtn.addEventListener('click', () => navigate(1));

        // 键盘导航
        document.addEventListener('keydown', onKeyDown);

        // 点击背景关闭
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) close();
        });

        // 触摸滑动
        lightbox.addEventListener('touchstart', onTouchStart, { passive: true });
        lightbox.addEventListener('touchend', onTouchEnd);
    }

    /**
     * 打开灯箱
     * @param {string} type - 'photography' | 'design'
     * @param {number} index - 图片索引
     */
    async function open(type, index) {
        currentType = type;
        currentIndex = index;

        // 加载数据并构建当前浏览列表
        try {
            const data = await DataLoader.load(type);

            if (type === 'photography') {
                const collections = data.collections || [];
                currentItems = collections.flatMap(c =>
                    (c.photos || []).map(p => ({
                        src: p.src,
                        title: p.title,
                        description: p.description,
                        date: p.date,
                        collection: c.title
                    }))
                );
            } else if (type === 'design') {
                const works = data.works || [];
                currentItems = works.map(w => ({
                    src: w.thumbnail || (w.images && w.images[0]) || '',
                    title: w.title,
                    description: w.description,
                    year: w.year,
                    category: w.category
                }));
            }

            if (currentItems.length === 0) {
                console.warn('No items to display');
                return;
            }

            // 确保索引有效
            currentIndex = Math.max(0, Math.min(index, currentItems.length - 1));

            // 显示灯箱
            lightbox.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // 显示当前图片
            showImage(currentIndex);

            // 更新导航按钮状态
            updateNavButtons();

        } catch (err) {
            console.error('Gallery open error:', err);
        }
    }

    /**
     * 显示指定索引的图片
     */
    function showImage(index) {
        const item = currentItems[index];
        if (!item) return;

        // 加载状态
        lightboxImg.classList.add('loading');

        if (item.src) {
            lightboxImg.src = item.src;
            lightboxImg.alt = item.title || '';
            lightboxImg.onload = () => lightboxImg.classList.remove('loading');
            lightboxImg.onerror = () => {
                lightboxImg.classList.remove('loading');
                lightboxImg.src = '';
                lightboxCaption.textContent = '🖼️ 图片加载失败 — 请检查文件路径';
            };
        } else {
            lightboxImg.src = '';
            lightboxImg.classList.remove('loading');
        }

        // 设置描述
        let caption = item.title || '';
        if (item.description) {
            caption += caption ? ` — ${item.description}` : item.description;
        }
        if (item.collection) {
            caption += `\n${item.collection} · ${item.date || ''}`;
        } else if (item.date || item.year) {
            caption += `\n${item.date || item.year} · ${item.category || ''}`;
        }
        lightboxCaption.textContent = caption || '';
    }

    /**
     * 导航
     */
    function navigate(direction) {
        if (currentItems.length === 0) return;
        currentIndex = (currentIndex + direction + currentItems.length) % currentItems.length;
        showImage(currentIndex);
        updateNavButtons();
    }

    /**
     * 更新导航按钮
     */
    function updateNavButtons() {
        prevBtn.style.visibility = currentItems.length > 1 ? 'visible' : 'hidden';
        nextBtn.style.visibility = currentItems.length > 1 ? 'visible' : 'hidden';
    }

    /**
     * 关闭灯箱
     */
    function close() {
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
        lightboxImg.src = '';
        currentItems = [];
    }

    /**
     * 键盘事件
     */
    function onKeyDown(e) {
        if (lightbox.classList.contains('hidden')) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                navigate(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigate(1);
                break;
            case 'Escape':
                e.preventDefault();
                close();
                break;
        }
    }

    /**
     * 触摸开始
     */
    function onTouchStart(e) {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }

    /**
     * 触摸结束 — 检测滑动方向
     */
    function onTouchEnd(e) {
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        // 水平滑动距离超过阈值
        const threshold = 50;
        if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
            navigate(dx > 0 ? -1 : 1);
        }
    }

    /**
     * 打开合集（摄影集封面墙专用）
     * @param {Array} photos — 预加载的照片数组
     * @param {number} index — 起始索引
     */
    function openCollection(photos, index) {
      currentType = 'collection';
      currentItems = photos.map(p => ({
        src: p.src,
        title: p.title,
        description: p.description,
        date: p.date,
        collection: ''
      }));
      currentIndex = Math.max(0, Math.min(index, currentItems.length - 1));

      if (currentItems.length === 0) return;

      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      showImage(currentIndex);
      updateNavButtons();
    }

    return { init, open, close, openCollection };
})();
