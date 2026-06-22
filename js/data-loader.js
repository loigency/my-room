/**
 * 数据加载器 — 负责加载和缓存 JSON 数据
 * 内容修改只需编辑 ../data/ 目录下的 JSON 文件
 */

const DataLoader = (() => {
    const cache = {};
    const basePath = 'data/';

    /**
     * 加载 JSON 数据文件
     * @param {string} name - 文件名（不含扩展名）
     * @returns {Promise<Object>}
     */
    async function load(name) {
        if (cache[name]) {
            return cache[name];
        }

        try {
            const response = await fetch(`${basePath}${name}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${name}.json: ${response.status}`);
            }
            const data = await response.json();
            cache[name] = data;
            return data;
        } catch (err) {
            console.error(`DataLoader: ${err.message}`);
            return getDefaultData(name);
        }
    }

    /**
     * 返回默认数据（当 JSON 文件不存在时使用）
     */
    function getDefaultData(name) {
        const defaults = {
            about: {
                name: '你的名字',
                avatar: '',
                bio: '摄影师 / 设计师 / 写作者',
                detail: '在这里写下你的个人介绍。点击编辑 data/about.json 文件来修改这些内容。\n\n你可以写多段文字，分享你的创作理念、艺术追求和人生故事。',
                timeline: [
                    { year: '2020', event: '开始摄影创作之旅' },
                    { year: '2021', event: '完成第一个设计项目' },
                    { year: '2022', event: '开设个人自媒体账号' },
                    { year: '2023', event: '举办首次个人作品展' }
                ]
            },
            photography: {
                collections: [
                    {
                        id: 'collection-1',
                        title: '光影集',
                        description: '捕捉生活中稍纵即逝的光影瞬间',
                        photos: [
                            { src: '', title: '示例作品 1', description: '在 data/photography.json 中添加你的摄影作品', date: '2024' },
                            { src: '', title: '示例作品 2', description: '将图片放入 assets/images/photography/ 目录', date: '2024' }
                        ]
                    }
                ]
            },
            design: {
                categories: ['品牌设计', '插画', 'UI设计', '其他'],
                works: [
                    { id: 'work-1', title: '示例设计作品', category: '品牌设计', thumbnail: '', images: [], description: '在 data/design.json 中添加你的设计作品', year: '2024' }
                ]
            },
            social: {
                platforms: [
                    { name: '小红书', icon: 'xiaohongshu', color: '#FF2442', url: '#', description: '分享设计作品、文艺感想' },
                    { name: '豆瓣', icon: 'douban', color: '#00B51D', url: '#', description: '工作学习干货分享' },
                    { name: '抖音', icon: 'douyin', color: '#000000', url: '#', description: '摄影作品、日常碎片' }
                ],
                featuredArticles: [
                    { title: '英语学习系统方法【长期/应试】', platform: '豆瓣', url: '#', summary: '如果你有长期学习英语的打算，这篇文章或许能给你带来帮助。', date: '2025' }
                ]
            }
        };

        return defaults[name] || {};
    }

    /**
     * 清除缓存
     */
    function clearCache(name) {
        if (name) {
            delete cache[name];
        } else {
            Object.keys(cache).forEach(k => delete cache[k]);
        }
    }

    return { load, clearCache, getDefaultData };
})();
