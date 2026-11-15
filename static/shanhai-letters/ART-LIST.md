# 《山海来信》AI 生图素材清单 v2.2（完整提示词版）

每张图的提示词都是**一整段、可直接复制**给图像模型使用，无需再拼接。
所有图共享的风格基调：国风水墨淡彩 + 现代扁平插画混合体，宣纸暖底，矿物色系
（朱砂红/石青/青瓷绿/赭石黄），细金线勾边，手绘柔边，绘本温度，构图留白大，
不要文字/水印/写实照片感。

---

## 0. 当前缺口清单（v2.2 界面审查后）

> 所有缺口都有代码兜底，**不补也能玩**。补齐后按第 5.7 节登记即可自动替换，无需改代码。

| 优先级 | 文件名 | 尺寸 / 格式 | 用在哪里 | 当前兜底 |
|---|---|---|---|---|
| **P0** | `ui-envelope.png` | 800×560 透明 PNG | 空信箱插画 | 内联 SVG 信封 |
| **P0** | `ui-shelf.png` | 1200×600 JPG/PNG | 驿站陈设木架底纹 | CSS 木纹渐变 |
| **P1** | `item-camera.png` | 256×256 透明 PNG | 行囊「旧式相机」 | Emoji 📷 |
| **P1** | `item-oldbook.png` | 256×256 透明 PNG | 行囊「古书残页」 | Emoji 📜 |
| **P1** | `item-umbrella.png` | 256×256 透明 PNG | 行囊「油纸伞」 | Emoji ☂️ |
| **P1** | `item-map.png` | 256×256 透明 PNG | 行囊「旅行地图」 | Emoji 🗺️ |
| **P1** | `item-osmanthus.png` | 256×256 透明 PNG | 行囊「桂花糕」 | Emoji 🍡 |
| **P1** | `item-bamboo.png` | 256×256 透明 PNG | 行囊「竹筒饭」 | Emoji 🍚 |
| **P1** | `item-hawthorn.png` | 256×256 透明 PNG | 行囊「山楂糕」 | Emoji 🍬 |
| **P1** | `item-notebook.png` | 256×256 透明 PNG | 行囊「空白手账」 | Emoji 📓 |
| **P1** | `item-bell.png` | 256×256 透明 PNG | 行囊「铜铃」 | Emoji 🔔 |
| **P1** | `item-lantern.png` | 256×256 透明 PNG | 行囊「小灯笼」 | Emoji 🏮 |
| **P1** | `ui-nav-yard.png` | 256×256 透明 PNG | 底栏「庭院」 | 内联 SVG 月洞门 |
| **P1** | `ui-nav-pack.png` | 256×256 透明 PNG | 底栏「行囊」 | 内联 SVG 包袱 |
| **P1** | `ui-nav-mail.png` | 256×256 透明 PNG | 底栏「信箱」 | 内联 SVG 信封 |
| **P1** | `ui-nav-codex.png` | 256×256 透明 PNG | 底栏「图鉴」 | 内联 SVG 书卷 |
| **P1** | `ui-nav-home.png` | 256×256 透明 PNG | 底栏「驿站」 | 内联 SVG 小屋 |
| P2（可选） | `home-yard.png` | 1600×900 JPG | 庭院页顶部横幅 | 复用 `home-hall.jpg` |

**已接入且无需再生成**：3 张神兽、6 张城市、30 张纪念品、`home-hall`、第一批 6 张 UI
（纸纹 / 卷轴 / 木牌 / 信纸 / 印章 / 图鉴封面）。

**已废弃、不要再生成**：`ui-cloth.png`（未使用）、`ui-yard-scene.png`（改用 `home-yard.png` 命名规则）。

**体积现状（v2.2 实测）**：神兽 PNG 447–529KB/张（目标 <300KB），纪念品 PNG 平均约 118KB
（目标 <50KB），城市 JPG 110–180KB，`home-hall.jpg` 205KB。素材本身可继续使用，
但若之后要压首屏体积，优先把神兽降到 320×320、纪念品降到 160×160 后再做无损压缩。

**统一纠偏原则**（针对白泽首版"诡异"反馈，适用于所有神兽立绘）：
不要第三只眼或多余器官；表情自然（calm / curious / gentle），不要假笑、不要腮红、
不要玻璃珠高光眼；四足或自然动物站姿，不做人类手势；要有地面和投影，拒绝黑底悬浮感。

**生成一致性建议**：同一批次连续生成、不要中途改风格；从九尾狐开始可把已完成的
`beast-baize.png` 作为参考图喂给模型；生成后统一裁尺寸 + 轻微降饱和 + 加 8% 宣纸噪点。

**体积要求**：单张 < 300KB，纪念品图标 < 50KB。
**存放位置**：全部放入 `static/shanhai-letters/assets/images/`，同名文件自动替换占位图，无需改代码。

---

## 1. 神兽立绘（1024×1024，透明背景 PNG，Q 版头身比约 1:1.5，四周留白 ≥8%）

### beast-baize.png ✅ 已完成（存档参考）

> A chibi mythical Chinese beast "Baize" — a gentle deer-like creature the size of a large dog, standing on all four legs, soft white-cream fluffy fur, small curved light-grey antlers, a modest silvery mane around the neck, round dark-brown gentle eyes with a natural calm expression, no smile, no blush, a plain forehead with no third eye, wearing a simple blue-grey cloth scarf draped on its back, an old cloth-bound book tied loosely beside it, standing on a small patch of warm rice-paper ground with a soft shadow beneath, soft warm lantern-light from the upper left, front-facing, full body. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, warm rice-paper background, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth, slightly whimsical, clean composition with generous negative space, no text, no watermark, no signature, no photographic realism.

### beast-jiuweihu.png

> A chibi mythical nine-tailed fox from Chinese legend — a cream-and-peach fox standing naturally on four legs, nine fluffy tails fanned out behind in a gentle arc, a simple red collar with one small golden bell, small dark eyes with a curious playful look, natural expression, no fixed smile, no blush, a tiny canvas travel backpack strapped on its back, one tail playfully raised, standing on a small patch of warm rice-paper ground with a soft shadow beneath, soft warm lantern-light from the upper left, front-facing, full body. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, warm rice-paper background, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth, slightly whimsical, clean composition with generous negative space, no text, no watermark, no signature, no photographic realism.

### beast-qingniao.png

> A chibi mythical Chinese blue bird "Qingniao" — a round plump bird standing naturally on two legs, celadon-to-azurite blue gradient feathers, long soft tail feathers, a small warm-red beak, gentle dark eyes with a shy curious expression, natural, no blush, a small letter envelope tied with string held under one wing, a tiny twig of herbs in its beak, standing on a small patch of warm rice-paper ground with a soft shadow beneath, soft warm lantern-light from the upper left, front-facing, full body. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, warm rice-paper background, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth, slightly whimsical, clean composition with generous negative space, no text, no watermark, no signature, no photographic realism.

---

## 2. 城市场景图（1600×900，16:9，JPG 或 PNG）

构图要求：横版远景明信片感，下 1/3 画面保持安静留白（放 UI），主体偏上，远景薄雾，无前景人物。

### city-xian.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. Ancient Xi'an city wall at dusk with a modern high-speed train passing in the distance, terracotta warm light, an old pagoda silhouette against a soft modern skyline, a tiny white deer-like creature silhouette walking along the wall, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

### city-chengdu.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. Chengdu night market alley, red lanterns strung overhead, hotpot steam rising, bamboo teahouse chairs by the roadside, neon signage softened by rain mist, a tiny nine-tailed fox silhouette peeking from an alley corner, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

### city-suzhou.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. Suzhou canal at dawn, whitewashed houses with dark tiles, a stone arched bridge, willow branches, a small rowboat, misty water reflection, a tiny blue bird silhouette flying far above, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

### city-hangzhou.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. West Lake in light rain, the broken bridge, lotus leaves, a distant pagoda on a hill, soft green-grey palette, ink-wash rain streaks, a small oil-paper umbrella floating near the shore, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

### city-dunhuang.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. Dunhuang desert at sunset, singing sand dunes, a distant Mogao cave cliff, a camel caravan silhouette, ochre and gold sky, a tiny blue bird silhouette crossing the sun, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

### city-harbin.png

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth. Harbin winter street, falling snow, ice-lantern glow, Russian-style onion domes, warm yellow window light against blue snow, tiny paw prints crossing the snow in the foreground, wide cinematic horizontal composition, no people in foreground, soft haze in distance, lower third of the frame kept calm and empty for UI overlay, no text, no watermark.

---

## 3. 纪念品图标（512×512，透明背景 PNG，单物件居中，底部柔和投影）

### sou-train-sketch.png

> A single isolated object icon: a childlike crayon sketch of a train on torn paper with the corner rolled, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-terracotta.png

> A single isolated object icon: a tiny terracotta warrior figurine with a chipped ear, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-paper-cut.png

> A single isolated object icon: a red paper-cut window flower of a rooster, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-wall-brick.png

> A single isolated object icon: a small grey brick fragment tied with hemp twine, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-bell-charm.png

> A single isolated object icon: a bronze bell charm on a red cord, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-hotpot-token.png

> A single isolated object icon: a wooden hotpot restaurant waiting-number token with grease stains, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-panda-ear.png

> A single isolated object icon: a pair of fluffy panda-ear hair clips, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-tea-lid.png

> A single isolated object icon: a chipped porcelain teacup lid, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-lantern.png

> A single isolated object icon: a tiny folded red paper lantern, slightly tilted, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-chili.png

> A single isolated object icon: a string of dried red chili peppers, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-paper-umbrella.png

> A single isolated object icon: a closed oil-paper umbrella in deep indigo, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-silk.png

> A single isolated object icon: a folded celadon silk handkerchief with an embroidered plum blossom, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-boat-paddle.png

> A single isolated object icon: a miniature wooden rowboat paddle, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-arch-stone.png

> A single isolated object icon: a smooth grey pebble naturally shaped like an arch bridge, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-kunqu-fan.png

> A single isolated object icon: a small painted Kunqu opera folding fan, half open, the face half painted and half blank, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-lotus-pod.png

> A single isolated object icon: a dried lotus seed pod with a few seeds loose, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-longjing.png

> A single isolated object icon: a pinch of longjing tea leaves in a folded paper packet, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-rain-bottle.png

> A single isolated object icon: a small glass bottle of rain water with a cork and a tiny blank paper tag, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-bridge-mark.png

> A single isolated object icon: a carved wooden bookmark shaped like a bridge with rounded edges, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-osmanthus.png

> A single isolated object icon: a small ceramic jar of candied osmanthus flowers with the lid ajar, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-sand-vial.png

> A single isolated object icon: a small glass vial of golden desert sand, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-camel-bell.png

> A single isolated object icon: a small brass camel bell with a worn strap, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-fresco.png

> A single isolated object icon: a fragment of mural painted on a clay shard showing an apsara figure, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-star-chart.png

> A single isolated object icon: a hand-drawn star chart on dark indigo paper with constellation dots connected by fine lines, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-ice-lantern.png

> A single isolated object icon: a small translucent ice-lantern replica glowing warm inside, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-snowflake.png

> A single isolated object icon: a six-folded paper-cut snowflake in pale blue, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-pinecone.png

> A single isolated object icon: a frost-covered pinecone with a few melting droplets, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-rail-map.png

> A single isolated object icon: a folded railway map booklet with hand-written margin notes and no readable text, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-postcard.png

> A single isolated object icon: a blank vintage postcard with a faded stamp and slightly worn corners, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### sou-handbook.png

> A single isolated object icon: a thick stitched notebook with a blank label on the cover, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

---

## 4. 家园场景（1600×1000）

### home-hall.png

> Cutaway illustration of a cozy small Chinese wooden house interior, warm lantern light, a large empty back wall for hanging objects, a wooden floor with open space in the lower third, one lattice window on the right showing soft blue sky, a low wooden table on the left, a small stove and a hanging scroll, warm ochre and wood tones, no furniture clutter, no characters, front-facing symmetrical composition. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, warm rice-paper background, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, no harsh black, children's-picture-book warmth, clean composition, no text, no watermark.

---

## 5. UI 与氛围素材（可后补）

### ui-paper.png（1024×1024，可平铺）

> Seamless rice paper texture, warm cream color, subtle fiber flecks, very low contrast, tileable pattern. Soft gouache texture, warm rice-paper background, no text, no watermark.

### ui-scroll-title.png（1200×400）

> A horizontal Chinese scroll banner unfurled, blank center area for title, wooden rollers at both ends, cinnabar and gold trim, no text. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments, delicate gold line accents, children's-picture-book warmth, no watermark.

### ui-wood-plank.png（600×120）

> A wooden sign plaque, blank surface, rope hanger, weathered wood grain, no text. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, warm ochre and wood tones, gentle hand-drawn outlines, no watermark.

### ui-letter-paper.png（900×1200）

> A piece of aged letter paper, faint ruled lines, a blank space for handwriting, slight stains, warm cream tone, no text. Soft gouache texture, warm rice-paper background, very low contrast, no watermark.

### ui-stamp-red.png（300×300）

> A traditional Chinese red seal stamp square, abstract seal script characters with no readable text, vermillion ink, slightly uneven edges. Flat vector with soft ink-wash shading, cinnabar red pigment, no watermark.

### codex-cover.png（800×1100）

> An ancient Chinese bound book cover, dark indigo cloth with a blank light label strip, gold thread trim, no text. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments, delicate gold line accents, children's-picture-book warmth, no watermark.

---

## 5.5 UI 素材（绘本小屋风 · 第二批）

> **说明**：游戏界面已重构为「旅行青蛙式绘本小屋」——物件隐喻代替控件（木牌=按钮、信封=列表、木架=收藏）。
> 下列素材**每张都有内联 SVG / CSS 兜底**，不生成也能玩；生成后放入同名文件、并在 `art-manifest.js` 登记即可自动替换。
> 命名规则：透明底用 `.png`，纹理底用 `.jpg` 或 `.png` 均可（代码两种都会尝试）。
> **`ui-cloth` 与 `ui-yard-scene` 已从代码中移除接入，可跳过；庭院背景请改用 `home-yard.png`（见第 0 节 P2）。**

**本批次统一风格句**（每条 prompt 末尾追加，与第一批一致）：

> Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), warm rice-paper background, gentle hand-drawn outlines, children's-picture-book warmth, no text, no watermark, no photographic realism.

### ui-nav-yard.png（256×256，透明底）

> A single simple hand-drawn icon of a Chinese garden moon gate — a round moon-shaped opening in a short wall, a tiny step below, one small leaf floating, drawn with a soft brush outline, warm wood-brown and celadon colors, centered with generous padding, flat icon style suitable for a mobile game bottom navigation bar. [风格句]

### ui-nav-pack.png（256×256，透明底）

> A single simple hand-drawn icon of a Chinese cloth travel bundle — a soft cloth knapsack tied at the top with a cord, a small wooden tag hanging from it, one chopstick and a rolled blanket peeking out, warm ochre and wood-brown colors, centered with generous padding, flat icon style suitable for a mobile game bottom navigation bar. [风格句]

### ui-nav-mail.png（256×256，透明底）

> A single simple hand-drawn icon of a small envelope with a red seal stamp in the corner, a tiny wing or feather tucked behind it suggesting a letter in flight, warm cream paper with a cinnabar red seal, centered with generous padding, flat icon style suitable for a mobile game bottom navigation bar. [风格句]

### ui-nav-codex.png（256×256，透明底）

> A single simple hand-drawn icon of an ancient Chinese thread-bound book slightly open, a silk ribbon bookmark hanging out, a small brush resting on top, indigo cover with gold trim and cream pages, centered with generous padding, flat icon style suitable for a mobile game bottom navigation bar. [风格句]

### ui-nav-home.png（256×256，透明底）

> A single simple hand-drawn icon of a small cozy Chinese posthouse — a tiny tiled-roof building with one warm-lit window and a hanging lantern by the door, a wisp of smoke from the chimney, warm ochre wood and celadon roof tiles, centered with generous padding, flat icon style suitable for a mobile game bottom navigation bar. [风格句]

### ui-envelope.png（800×560，透明底）

> A single hand-drawn envelope lying flat, slightly open with a cream letter peeking out the top, a small red wax seal on the flap, a faint postmark circle with no readable text, warm cream paper with soft paper grain, gentle drop shadow, three-quarter view. [风格句]

### ui-shelf.png（1200×600，JPG 或 PNG）

> A wooden display shelf board seen straight on — warm light oak plank surface with visible gentle wood grain, a soft darker wooden ledge running along the bottom edge of each row, a few tiny nail heads, slightly worn edges, empty and clean, ready to display small objects on top. Warm ochre and wood-brown tones, soft gouache texture, flat front view, no objects on the shelf, no text, no watermark.

### ~~ui-cloth.png~~（已废弃，跳过）

> A soft cotton cloth spread flat, seen from above — warm oatmeal and faded indigo patchwork with gentle stitching lines, a few natural folds and wrinkles, slightly worn edges, empty and clean, ready to lay small travel items on top. Soft gouache texture, warm rice-paper lighting, top-down flat view, no objects on the cloth, no text, no watermark.

### ~~ui-yard-scene.png~~（已废弃；庭院背景改用 home-yard.png）

> A small Chinese courtyard seen from inside a room looking out — a stone-paved yard with one old tree, a low wall with a moon gate, a wooden bench, a stone water basin, warm late-afternoon light casting long soft shadows, a tiny folded paper umbrella leaning by the door. Lower third kept calm for UI overlay, no people, no animals, no text, no watermark. [风格句]

> **优先级**：`ui-envelope`、`ui-shelf`、`ui-nav-*` 五张 > 十个道具图标 > `home-yard`（可选）。
> `ui-cloth` / `ui-yard-scene` 已不再接入，跳过。

---

## 5.6 随身道具图标（v2.2 新增，256×256，透明底 PNG）

> 行囊页目前用 Emoji 兜底；补齐后行囊会统一成和纪念品一致的绘本质感。
> 命名必须是 `item-<道具id>.png`，放在 `assets/images/`。

**本批次统一风格句**：

> A single isolated object icon, centered, transparent background, flat vector with soft ink-wash shading, soft drop shadow beneath, front view, no text, no hands, no background scene. Chinese ink-wash illustration blended with modern flat vector art, soft gouache texture, muted mineral pigments (cinnabar red, azurite blue, celadon green, ochre yellow), delicate gold line accents, gentle hand-drawn outlines, children's-picture-book warmth, no watermark.

### item-camera.png（旧式相机）

> A small vintage folding camera with worn brass edges and a leather strap. [风格句]

### item-oldbook.png（古书残页）

> A single torn page of an ancient thread-bound book with faint ink writing and curled edges. [风格句]

### item-umbrella.png（油纸伞）

> A closed oil-paper umbrella tied with a cord, deep indigo canopy, bamboo ribs. [风格句]

### item-map.png（旅行地图）

> A folded travel map with hand-drawn winding routes and a few pencil marks, corners worn. [风格句]

### item-osmanthus.png（桂花糕）

> A small paper box of pale osmanthus cakes with a few golden petals scattered on top. [风格句]

### item-bamboo.png（竹筒饭）

> A short bamboo tube split open at the top, steamed rice peeking out, a leaf tie around it. [风格句]

### item-hawthorn.png（山楂糕）

> A small ruby-red hawthorn candy cake on a piece of oil paper, slightly translucent. [风格句]

### item-notebook.png（空白手账）

> A small cloth-bound blank notebook with a silk ribbon and a short brush tucked in the strap. [风格句]

### item-bell.png（铜铃）

> A small bronze hand bell on a braided red cord, warm patina. [风格句]

### item-lantern.png（小灯笼）

> A tiny folded paper lantern glowing warm from inside, a short bamboo handle. [风格句]

---

## 5.7 可选素材登记（重要）

为了避免每次打开页面都为尚未生成的图发 404，可选素材统一登记在：

```
static/shanhai-letters/assets/images/art-manifest.js
```

把**去掉扩展名**的文件名加进 `optional` 数组即可，刷新页面生效：

```js
window.SH_ART = {
  optional: ['ui-envelope', 'ui-shelf', 'ui-nav-mail', 'item-camera', 'home-yard']
};
```

- 必选素材（神兽 / 城市 / 纪念品 / `home-hall` / 第一批 UI）不用登记。
- 想批量检查素材是否被正确加载，可临时访问 `index.html?art=all`，强制探测全部可选文件名。
- 代码会自动尝试同名 `.png` / `.jpg`；两个都没有时回到内联 SVG、Emoji 或渐变兜底。

---

## 6. 生成顺序建议

1. ~~beast-jiuweihu、beast-qingniao~~（已完成）
2. ~~home-hall~~（已完成）
3. ~~6 张城市图~~（已完成）
4. ~~30 张纪念品图标~~（已完成）
5. **P0 缺口**：`ui-envelope`、`ui-shelf`
6. **P1 缺口**：10 张 `item-*.png`（同一批次生成，风格最稳）
7. **P1 缺口**：5 张 `ui-nav-*.png`（共用一段 prompt 只换主体）
8. P2（可选）：`home-yard.png`

全部生成好放入 `static/shanhai-letters/assets/images/`，并把文件名加入
`assets/images/art-manifest.js` 的 `optional` 数组后叫我，我做接入和验收。

### 验收清单

- [ ] 文件名、扩展名与第 0 节完全一致（区分 `ui-nav-*` 与 `item-*`）
- [ ] 透明底 PNG 四周无白边、无黑底、无残留阴影方块
- [ ] 图标主体占画布 70%–85%，缩到 34px / 54px 仍能辨认
- [ ] 同一批素材光源方向一致（左上暖光），色温与现有神兽一致
- [ ] 单张体积：道具 / 导航图标 < 60KB，`ui-shelf` < 250KB
- [ ] 已登记到 `art-manifest.js`
- [ ] 刷新后：底栏图标、空信箱、驿站木架、行囊道具四处无 Emoji / 无 SVG 混用
- [ ] 打开 `index.html?art=all` 时控制台无 404
- [ ] 手机 390px 与 320px 宽度下图标不变形、不溢出卡片
