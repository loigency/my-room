# 🏠 一间属于自己的房间

> *"A woman must have money and a room of her own if she is to write fiction."* — Virginia Woolf

一个艺术风格的交互式个人 Portfolio 网站。打开后呈现一个手绘风格的艺术房间场景，点击房间中的不同物品可以进入不同的内容板块。

## ✨ 特色

- 🎨 **艺术房间场景** — 纯 SVG 手绘房间，莫奈印象派色调
- 🖱️ **游戏式交互** — 点击房间物品探索不同内容板块
- 🌟 **氛围动画** — 窗光粒子、台灯脉动、窗帘微动、鼠标视差
- 📱 **响应式设计** — 适配桌面、平板和手机
- 📝 **JSON 数据驱动** — 修改内容只需编辑 JSON 文件，无需懂代码
- 🚀 **零依赖** — 纯 HTML/CSS/JS，可部署到任何静态托管

## 🗺️ 房间指南

| 房间物品 | 对应内容 |
|---------|---------|
| 🖼️ 墙上画框 | 摄影作品集 |
| 🎨 画架上的画布 | 设计作品集 |
| 📷 桌上的照片 | 个人介绍 |
| ✍️ 打字机 & 书本 | 自媒体平台 & 代表文章 |

## 📁 文件结构

```
art-room/
├── index.html              # 主页面（含 SVG 房间场景）
├── css/
│   ├── main.css            # 全局样式、色彩变量
│   ├── room.css            # 房间动画、交互样式
│   ├── overlays.css        # 内容面板样式
│   └── gallery.css         # 画廊和灯箱样式
├── js/
│   ├── main.js             # 入口文件
│   ├── room-interaction.js # 房间交互逻辑
│   ├── parallax.js         # 鼠标视差效果
│   ├── gallery.js          # 图片灯箱
│   └── data-loader.js      # JSON 数据加载
├── data/
│   ├── about.json          # ✏️ 个人介绍
│   ├── photography.json    # ✏️ 摄影作品
│   ├── design.json         # ✏️ 设计作品
│   └── social.json         # ✏️ 自媒体 & 文章
├── assets/
│   └── images/
│       ├── photography/    # 📸 放入你的摄影作品
│       ├── design/         # 🎨 放入你的设计作品
│       └── about/          # 👤 放入你的个人照片
└── README.md
```

## 🚀 快速开始

### 1. 修改内容

编辑 `data/` 目录下的 JSON 文件，替换为你的个人信息和作品：

- **个人介绍**: 编辑 `data/about.json`
- **摄影作品**: 编辑 `data/photography.json`
- **设计作品**: 编辑 `data/design.json`
- **自媒体**: 编辑 `data/social.json`

### 2. 添加图片

将你的作品图片放入对应目录：
- 摄影作品 → `assets/images/photography/`
- 设计作品 → `assets/images/design/`
- 个人照片 → `assets/images/about/`

然后在对应的 JSON 文件中填写图片路径，例如：
```json
{
    "src": "assets/images/photography/my-photo.jpg",
    "title": "我的作品"
}
```

### 3. 本地预览

用任意 HTTP 服务器打开项目：

**方法一：VS Code Live Server 插件**
安装后右键 `index.html` → "Open with Live Server"

**方法二：Python**
```bash
cd art-room
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

### 4. 部署到 GitHub Pages

1. 在 GitHub 上创建新仓库
2. 将 `art-room/` 目录下的所有文件推送到仓库
3. 在仓库 Settings → Pages 中启用 GitHub Pages
4. 选择分支（通常是 `main`），点击 Save
5. 几分钟后，你的网站就可以通过 `https://你的用户名.github.io/仓库名` 访问了

## 🎨 自定义颜色

在 `css/main.css` 的 `:root` 中修改 CSS 变量：

```css
:root {
    --color-wall: #F5F0E8;        /* 墙面颜色 */
    --color-wood-dark: #5C3D2E;   /* 深色木材 */
    --color-wood: #6B4226;        /* 木材主色 */
    --color-curtain: #8FA4B8;     /* 窗帘颜色 */
    --color-rug: #C47A4E;         /* 地毯颜色 */
    /* ... 更多变量见文件 */
}
```

## 📝 许可

可自由使用和修改。

---

*希望这个房间，能成为你展示创作的温暖角落。* 🌿
