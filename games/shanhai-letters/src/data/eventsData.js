/**
 * 《山海来信》事件与叙事库（85+ 精品事件 + 反差印记奇遇 + 双兽合写 + 组合式短笺模板）
 */

export const EVENTS = [
  /* ================= 通用：现代生活初见（city: *） ================= */
  {
    id: 'ev-transit', city: '*', beast: '*', tags: ['travel', 'city'], weight: 10,
    title: '会跑的铁屋子', souvenir: 'sou-postcard', insight: 1,
    body: '今天坐了一次会自己跑的铁屋子，里面坐满了人，却没有一匹马。\n有人闭着眼，有人在看一块发光的小板子，谁也不说话。\n我数了数，一共三十七个人，只有两个在往外看。',
    cause: '它第一次独自坐上公共交通',
    reply: [
      { text: '下次可以看看窗外', trait: 'calm', memory: { look_out: 1 } },
      { text: '跟旁边的人说句话试试', trait: 'empathy', memory: { talk_stranger: 1 } },
      { text: '记下来，回去慢慢想', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-convenience', city: '*', beast: '*', tags: ['city', 'curious'], weight: 9,
    title: '不熄灯的屋子', souvenir: 'sou-postcard', insight: 1,
    body: '发现一种屋子，半夜也不熄灯，里面摆满了吃的。\n我问店员："夜里不怕贼吗？"\n她笑了一下，指了指头顶一个小黑盒子，说："有它看着呢。"\n我抬头看了很久。那大概是一种守夜的精灵。',
    cause: '它走进了一家便利店',
    reply: [
      { text: '那个不是精灵，是摄像头', trait: 'scholar', memory: { explain_camera: 1 } },
      { text: '守夜的东西，也值得谢谢', trait: 'empathy', memory: { thank_machine: 1 } },
      { text: '你怕黑吗？', trait: 'calm', memory: { ask_fear: 1 } }
    ]
  },
  {
    id: 'ev-escalator', city: '*', beast: '*', tags: ['city', 'playful'], weight: 8,
    title: '会走路的台阶', souvenir: 'sou-postcard', insight: 1,
    body: '这里有一种台阶，自己会往上走。\n我站上去，又赶紧跳下来，来回试了六次。\n旁边一个小孩说："奶奶你看，这只狗好奇怪。"\n我想解释，又觉得解释起来更奇怪，就走了。',
    cause: '它遇见了自动扶梯',
    reply: [
      { text: '下次可以跟小孩打个招呼', trait: 'food', memory: { talk_kid: 1 } },
      { text: '再试一次，这次走到顶', trait: 'brave', memory: { brave: 1 } },
      { text: '画下来给我看', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-videocall', city: '*', beast: '*', tags: ['city', 'letter'], weight: 9,
    title: '千里传音', souvenir: 'sou-postcard', insight: 1,
    body: '看见一个人在街上，对着一块小镜子说话，镜子里还传出另一个人的声音。\n我以为那是传说中的千里传音之术，激动得差点上前请教。\n走近一听，他在说："妈，我今晚不回来吃了。"\n原来法术都是用来讲这些话的。',
    cause: '它撞见了有人打视频电话',
    reply: [
      { text: '家常话也值得跑那么远', trait: 'empathy', memory: { value_ordinary: 1 } },
      { text: '你也可以试试给我传音', trait: 'brave', memory: { call_me: 1 } },
      { text: '那你今晚想吃什么？', trait: 'food', memory: { care_back: 1 } }
    ]
  },
  {
    id: 'ev-rider', city: '*', beast: '*', tags: ['city', 'social'], weight: 8,
    title: '跑得很快的人', souvenir: 'sou-postcard', insight: 1,
    body: '街上有一群穿着同样颜色衣服的人，骑得极快，车后绑着一个方箱子。\n他们好像在跟时间赛跑——虽然我不知道时间为什么值得追。\n有一个在红灯前停下来，仰头喝了一口水，又走了。',
    cause: '它注意到了外卖骑手',
    reply: [
      { text: '跟他说一声辛苦了', trait: 'empathy', memory: { thank_worker: 1 } },
      { text: '他们追的是别人的晚饭', trait: 'food', memory: { understand_others: 1 } },
      { text: '别学他们，路上慢慢走', trait: 'calm', memory: { slow_down: 1 } }
    ]
  },
  {
    id: 'ev-squaredance', city: '*', beast: '*', tags: ['social', 'night'], weight: 7,
    title: '广场上的舞', souvenir: 'sou-postcard', insight: 1,
    body: '傍晚的广场上，几十个人跟着一个方盒子放出来的曲子跳舞。\n没有祭祀，没有缘由，就是跳。\n有个阿姨拉我进去，我跳错了三步，没人介意。',
    cause: '它被拉进了广场舞的队伍',
    reply: [
      { text: '多去几次，跳会了教我', trait: 'food', memory: { join_in: 1 } },
      { text: '问问她们为什么天天来', trait: 'empathy', memory: { ask_story: 1 } },
      { text: '你在旁边看着就好', trait: 'calm', memory: { stay_watcher: 1 } }
    ]
  },
  {
    id: 'ev-qr', city: '*', beast: '*', tags: ['city', 'curious'], weight: 7,
    title: '一块花纹布', souvenir: 'sou-postcard', insight: 1,
    body: '买东西不用给钱，只要把一块小方块对着画满花纹的牌子照一下。\n我研究了半天，觉得这是一种符——画符的人不用懂，认符的东西自己会认。\n上古也有这样的符。只不过那时候，认符的是山神。',
    cause: '它看见了扫码支付',
    reply: [
      { text: '上古的符也是这样吗', trait: 'scholar', memory: { link_ancient: 1 } },
      { text: '你的理解其实很接近', trait: 'empathy', memory: { explain_gently: 1 } },
      { text: '别想了，先买点吃的', trait: 'food', memory: { enjoy_now: 1 } }
    ]
  },
  {
    id: 'ev-schoolout', city: '*', beast: '*', tags: ['social', 'quiet'], weight: 7,
    title: '放学的时候', souvenir: 'sou-postcard', insight: 1,
    body: '下午四点，突然多出很多很小的孩子，背着比自己还大的包。\n他们讨论着今天发生的事，声音又急又亮。\n有一个走得很慢，边走边踢石子。我陪他走了两个路口。',
    cause: '它赶上了放学',
    reply: [
      { text: '他是不是有心事', trait: 'empathy', memory: { notice_child: 1 } },
      { text: '陪他走到家吧', trait: 'calm', memory: { walk_along: 1 } },
      { text: '你小时候也这样吗', trait: 'food', memory: { ask_past: 1 } }
    ]
  },

  /* ================= 天气限定 ================= */
  {
    id: 'ev-rain-shelter', city: '*', beast: '*', tags: ['rain', 'quiet'], weight: 12, weather: 'rain',
    title: '檐下躲雨', souvenir: 'sou-rain-bottle', insight: 1,
    body: '下雨了。我躲在一户人家的屋檐下，屋里飘出饭香。\n主人的猫隔着门缝看我，看了很久，然后睡着了。\n雨停的时候我才发现，自己也不急着走了。',
    cause: '路上遇到了雨',
    reply: [
      { text: '下次带把伞', trait: 'brave', memory: { bring_umbrella: 1 } },
      { text: '雨声好听吗', trait: 'calm', memory: { love_rain: 1 } },
      { text: '敲敲门，问问能不能进屋', trait: 'empathy', memory: { knock_door: 1 } }
    ]
  },
  {
    id: 'ev-snow-night', city: '*', beast: '*', tags: ['snow', 'quiet'], weight: 12, weather: 'snow',
    title: '雪落下来的时候', souvenir: 'sou-snowflake', insight: 1,
    body: '下雪了。很安静，安静得能听见雪落在雪上的声音。\n有个小孩把手套摘了，伸手去接，他妈妈骂了他一句，又把自己的手套给他套上。\n我忽然想起青丘的雪，也是这样不讲道理地白。',
    cause: '它遇上了雪',
    reply: [
      { text: '把手套给它一只', trait: 'empathy', memory: { share_warmth: 1 } },
      { text: '雪和青丘的一样吗', trait: 'scholar', memory: { miss_home: 1 } },
      { text: '多待一会儿再回来', trait: 'calm', memory: { stay_longer: 1 } }
    ]
  },
  {
    id: 'ev-night-lights', city: '*', beast: '*', tags: ['night', 'quiet'], weight: 12, weather: 'night',
    title: '万家的灯', souvenir: 'sou-lantern', insight: 1,
    body: '天黑以后，我爬到一个很高的地方往下看。\n下面是一格一格的灯，每一格里都有一件正在进行的小事。\n有的在吃饭，有的在吵架，有的把灯关了——那是睡了。\n上古的时候，我们管这叫人间烟火。原来它一直都在。',
    cause: '它在夜里登高看灯',
    reply: [
      { text: '哪一格最让你在意', trait: 'empathy', memory: { notice_one: 1 } },
      { text: '回来也给你留一盏', trait: 'calm', memory: { keep_light: 1 } },
      { text: '写下来，这是最好的一句', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },

  /* ================= 西安 ================= */
  {
    id: 'ev-xian-wall', city: 'xian', beast: '*', tags: ['history', 'ancient'], weight: 11,
    title: '城墙与长龙', souvenir: 'sou-wall-brick', insight: 2,
    body: '我沿着城墙走了很久。墙很老，砖缝里长着草。\n墙根下，一列钢铁长龙轰隆隆地开过去，声音震得墙上的草都在抖。\n一千年和一百八十年，就这样叠在同一个画面里。',
    cause: '它去了西安城墙',
    reply: [
      { text: '草和火车你更在意哪个', trait: 'scholar', memory: { ask_focus: 1 } },
      { text: '拍下来给我看看', trait: 'calm', memory: { record_habit: 1 } },
      { text: '墙还在，就是好事', trait: 'empathy', memory: { value_endure: 1 } }
    ]
  },
  {
    id: 'ev-xian-terracotta', city: 'xian', beast: '*', tags: ['history', 'scholar'], weight: 10,
    title: '站了很久的人', souvenir: 'sou-terracotta', insight: 2,
    body: '在一个大坑里，站着几千个陶土做的人，排得整整齐齐。\n讲解员说，他们替一个皇帝站了两千多年。\n我走到边上，跟最近的一个说了句话："辛苦了。"\n它当然没有回答。可我站了一会儿，觉得它听见了。',
    cause: '它去了兵马俑',
    reply: [
      { text: '你说得对，他听见了', trait: 'empathy', memory: { comfort_beast: 1 } },
      { text: '回来跟我说说那个皇帝', trait: 'scholar', memory: { ask_history: 1 } },
      { text: '下次带九尾狐一起去', trait: 'food', memory: { bring_friend: 1 } }
    ]
  },
  {
    id: 'ev-xian-food', city: 'xian', beast: '*', tags: ['food', 'social'], weight: 9,
    title: '一碗泡馍', souvenir: 'sou-hotpot-token', insight: 1,
    body: '吃了一碗要把饼自己掰碎的汤。隔壁桌的大爷教我：要掰成黄豆大小，太大不入味。\n我掰了四十分钟，他全程看着，最后说："行，勉强。"\n这是我来人间以后，第一次被人手把手地教一件事。',
    cause: '它钻进了西安的小馆子',
    reply: [
      { text: '下次教他点你的本事', trait: 'brave', memory: { teach_back: 1 } },
      { text: '一碗汤掰四十分钟，值得', trait: 'calm', memory: { value_slow: 1 } },
      { text: '大爷叫什么名字', trait: 'food', memory: { ask_name: 1 } }
    ]
  },
  {
    id: 'ev-xian-belltower', city: 'xian', beast: '*', tags: ['history', 'night'], weight: 8,
    title: '钟鼓相闻', souvenir: 'sou-bell-charm', insight: 2,
    body: '暮色压下来的时候，钟楼的灯全亮了，像浮在车流中间的一座金亭。\n我听见有人在下面等公交，说："过了钟楼就到家。"\n从前敲钟报时辰，如今它变成了一座城市的路标。',
    cause: '它在暮色中路过钟楼',
    reply: [
      { text: '路标比报时更温柔', trait: 'empathy', memory: { value_endure: 1 } },
      { text: '把钟声也画下来', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '我也给你留一盏回家的灯', trait: 'calm', memory: { keep_light: 1 } }
    ]
  },

  /* ================= 成都 ================= */
  {
    id: 'ev-chengdu-hotpot', city: 'chengdu', beast: '*', tags: ['food', 'social'], weight: 11,
    title: '红汤里捞月亮', souvenir: 'sou-chili', insight: 1,
    body: '他们把一锅红汤放在桌子中间，谁都可以往里下东西。\n我试图从汤里捞月亮的倒影，捞了七次，七次都是毛肚。\n同桌的人笑得不行，最后替我捞了一片，说："这个比月亮好吃。"',
    cause: '它吃了火锅',
    reply: [
      { text: '好吃吗', trait: 'food', memory: { ask_taste: 1 } },
      { text: '跟他们要个联系方式', trait: 'empathy', memory: { keep_contact: 1 } },
      { text: '下次带我一起去', trait: 'brave', memory: { bring_me: 1 } }
    ]
  },
  {
    id: 'ev-chengdu-teahouse', city: 'chengdu', beast: '*', tags: ['quiet', 'tea'], weight: 10,
    title: '一整个下午', souvenir: 'sou-tea-lid', insight: 2,
    body: '茶馆里坐满了人，什么都不做，就坐着。\n有个人掏耳朵掏了二十分钟，表情像在冥想。\n我问邻座："你们不赶时间吗？"\n他说："赶啊，但我先把这一口茶喝完。"',
    cause: '它在茶馆里坐了一下午',
    reply: [
      { text: '这句话值得记下来', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '你也坐到打烊吧', trait: 'calm', memory: { stay_longer: 1 } },
      { text: '回来我给你泡茶', trait: 'empathy', memory: { care_back: 1 } }
    ]
  },
  {
    id: 'ev-chengdu-panda', city: 'chengdu', beast: '*', tags: ['playful', 'city'], weight: 9,
    title: '满街的耳朵', souvenir: 'sou-panda-ear', insight: 1,
    body: '街上很多人头上顶着黑白两色的耳朵。我以为那是某种新的图腾。\n后来才知道，是一种本地的熊。人们喜欢它，喜欢到要把它戴在头上。\n我买了一对戴上。走过三条街，没人回头。我有点失落，又有点松了口气。',
    cause: '它买了熊猫发箍',
    reply: [
      { text: '戴上很好看，真的', trait: 'empathy', memory: { comfort_beast: 1 } },
      { text: '没人回头说明你融入了', trait: 'calm', memory: { belong: 1 } },
      { text: '留着回来给我看', trait: 'food', memory: { keep_item: 1 } }
    ]
  },

  /* ================= 苏州 ================= */
  {
    id: 'ev-suzhou-boat', city: 'suzhou', beast: '*', tags: ['water', 'quiet'], weight: 11,
    title: '摇橹的人', souvenir: 'sou-boat-paddle', insight: 2,
    body: '坐了一次手摇的船。摇橹的阿姨一只手撑着，一只手在织毛衣。\n船过桥洞的时候她抬头看了一眼，说："这个洞，我家三代人都在下面过。"\n水很绿，把桥也染绿了。',
    cause: '它坐上了苏州的摇橹船',
    reply: [
      { text: '问问她家还有谁在摇船', trait: 'empathy', memory: { ask_story: 1 } },
      { text: '三代人，那桥该记得他们', trait: 'scholar', memory: { value_endure: 1 } },
      { text: '学着摇两下试试', trait: 'brave', memory: { try_new: 1 } }
    ]
  },
  {
    id: 'ev-suzhou-embroidery', city: 'suzhou', beast: '*', tags: ['craft', 'quiet'], weight: 10,
    title: '绣了半年的梅花', souvenir: 'sou-silk', insight: 2,
    body: '一间小绣坊里，一个姑娘正在绣一朵梅花，说已经绣了半年。\n我问："一天绣多久？"\n她说："八个小时。绣错一针，就要拆一天。"\n我看那朵梅，第六片花瓣上确实拆过。',
    cause: '它走进了苏州绣坊',
    reply: [
      { text: '拆过的地方最好看', trait: 'empathy', memory: { comfort_others: 1 } },
      { text: '问问她为什么坚持', trait: 'scholar', memory: { ask_story: 1 } },
      { text: '买下来带回来', trait: 'calm', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-suzhou-alley', city: 'suzhou', beast: '*', tags: ['rain', 'quiet'], weight: 9,
    title: '一条走不完的巷子', souvenir: 'sou-paper-umbrella', insight: 1,
    body: '下雨，我拐进一条很窄的巷子。\n墙上有苔，脚下有水，尽头有一盏灯，灯下有人在剥豆子。\n我站在那里看了很久。她抬头说："进来躲雨啊。"\n我摇摇头。我不是在躲雨，我是在看。',
    cause: '雨让它拐进了小巷',
    reply: [
      { text: '下次就进去吧', trait: 'brave', memory: { knock_door: 1 } },
      { text: '你在看什么', trait: 'scholar', memory: { ask_focus: 1 } },
      { text: '这条巷子叫什么名字', trait: 'calm', memory: { ask_name: 1 } }
    ]
  },

  /* ================= 杭州 ================= */
  {
    id: 'ev-hangzhou-rain', city: 'hangzhou', beast: '*', tags: ['rain', 'quiet', 'nature'], weight: 11,
    title: '断桥的雨', souvenir: 'sou-rain-bottle', insight: 2,
    body: '断桥上人很多，都在躲雨，又都不肯走。\n一个小孩问妈妈："桥断了为什么还能走？"\n妈妈说："它没断，是雪化了一半的时候看着像断了。"\n原来有些名字，记的是某一瞬间。',
    cause: '它在断桥遇雨',
    reply: [
      { text: '这个名字真浪漫', trait: 'empathy', memory: { love_romance: 1 } },
      { text: '你看见雪化的时候了吗', trait: 'scholar', memory: { ask_focus: 1 } },
      { text: '装一瓶雨回来', trait: 'calm', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-hangzhou-tea', city: 'hangzhou', beast: '*', tags: ['tea', 'quiet', 'nature'], weight: 10,
    title: '炒茶的手', souvenir: 'sou-longjing', insight: 2,
    body: '在山上看人炒茶。锅很烫，他的手直接伸进去，翻、抖、压，一气呵成。\n我问："不烫吗？"\n他说："烫啊，所以要快。"\n我数了数，他从十六岁开始，这只手伸了四十年。',
    cause: '它去看了炒茶',
    reply: [
      { text: '买一包回来', trait: 'food', memory: { keep_item: 1 } },
      { text: '问问他的师傅是谁', trait: 'empathy', memory: { ask_story: 1 } },
      { text: '这双手该写进书上', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-hangzhou-osmanthus', city: 'hangzhou', beast: '*', tags: ['nature', 'food'], weight: 9,
    title: '一整个秋天的味道', souvenir: 'sou-osmanthus', insight: 1,
    body: '满城都是桂花香，香得有点不讲道理。\n有个阿婆在树下铺了布，摇树干，花就落下来。她说要腌一罐，留到冬天。\n我问："为什么留到冬天？"\n她说："冬天没有味道，得留一点。"',
    cause: '它赶上了桂花季',
    reply: [
      { text: '带一罐回来', trait: 'food', memory: { keep_item: 1 } },
      { text: '冬天我们也留一点', trait: 'empathy', memory: { care_back: 1 } },
      { text: '这话该写下来', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },

  /* ================= 敦煌 ================= */
  {
    id: 'ev-dunhuang-cave', city: 'dunhuang', beast: '*', tags: ['history', 'craft'], weight: 11,
    title: '洞里的飞天', souvenir: 'sou-fresco', insight: 2,
    body: '洞里不许拍照，也不许大声。\n手电照上去的时候，一个飞天的脸亮了半秒。她飞了一千多年，还没落地。\n讲解员说，这些画是普通人一笔一笔画的，很多人一辈子没留下名字。\n我站在暗处，觉得有点熟。',
    cause: '它进了莫高窟',
    reply: [
      { text: '没名字的人也值得记', trait: 'empathy', memory: { value_ordinary: 1 } },
      { text: '你也是被画在墙上的那一类', trait: 'scholar', memory: { link_ancient: 1 } },
      { text: '别难过，画还在', trait: 'calm', memory: { comfort_beast: 1 } }
    ]
  },
  {
    id: 'ev-dunhuang-sand', city: 'dunhuang', beast: '*', tags: ['desert', 'nature'], weight: 10,
    title: '会唱歌的沙', souvenir: 'sou-sand-vial', insight: 1,
    body: '爬上沙山顶的时候，太阳正好下去。\n沙子真的会响——很多人一起往下滑，整座山都在低鸣。\n我想起古籍里写过"沙鸣如雷"，当时以为是夸张。\n原来夸张的从来不是古人，是我没来过。',
    cause: '它爬上了鸣沙山',
    reply: [
      { text: '装一瓶沙回来', trait: 'food', memory: { keep_item: 1 } },
      { text: '古籍还写过什么', trait: 'scholar', memory: { link_ancient: 1 } },
      { text: '天黑了就别待太久', trait: 'empathy', memory: { care_back: 1 } }
    ]
  },
  {
    id: 'ev-dunhuang-star', city: 'dunhuang', beast: '*', tags: ['star', 'record'], weight: 9,
    title: '自己画的星图', souvenir: 'sou-star-chart', insight: 2,
    body: '这里的星星多得吓人，像有人把整条银河倒扣了下来。\n我试着把认识的名字一个一个对上去，对到一半发现：上古那些名字，这里都还在。\n只是没人叫了。\n我画了一张图，边上写了我自己的叫法。',
    cause: '它在敦煌看了一夜星星',
    reply: [
      { text: '你的叫法也要写上去', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '带回来给我讲一整夜', trait: 'calm', memory: { bring_me: 1 } },
      { text: '没人叫的名字，你会一直叫吗', trait: 'empathy', memory: { ask_promise: 1 } }
    ]
  },

  /* ================= 哈尔滨 ================= */
  {
    id: 'ev-harbin-ice', city: 'harbin', beast: '*', tags: ['snow', 'night'], weight: 11,
    title: '会化的房子', souvenir: 'sou-ice-lantern', insight: 2,
    body: '他们用冰盖了一整座城，里面还埋了灯。\n我摸了摸墙，冷得干脆利落。\n一个工人说："暖和了就没了，明年再盖。"\n我想了想，说："那你们每年都要重盖一次。"\n他说："对啊，所以每年都不一样。"',
    cause: '它走进了冰雪大世界',
    reply: [
      { text: '每年都不一样，真好', trait: 'calm', memory: { value_change: 1 } },
      { text: '趁它还在，多待会儿', trait: 'brave', memory: { stay_longer: 1 } },
      { text: '带一块回来', trait: 'food', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-harbin-window', city: 'harbin', beast: '*', tags: ['snow', 'quiet'], weight: 10,
    title: '结霜的窗', souvenir: 'sou-snowflake', insight: 2,
    body: '零下二十几度。街上的窗玻璃都结着厚厚的霜花，从外面看不见里面。\n可每一扇窗都透出黄色的光。\n我忽然想：里面的人也看不见外面，可他们知道外面很冷——所以才把灯留着。',
    cause: '它在哈尔滨的街上走了很久',
    reply: [
      { text: '回来给你留灯', trait: 'empathy', memory: { keep_light: 1 } },
      { text: '你在外面冷吗', trait: 'food', memory: { care_beast: 1 } },
      { text: '写下来，这句很好', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-harbin-pear', city: 'harbin', beast: '*', tags: ['food', 'snow'], weight: 9,
    title: '冻梨', souvenir: 'sou-pinecone', insight: 1,
    body: '一种黑色的梨，冻得硬邦邦，要在水里慢慢缓开。\n卖梨的大爷说："急不得，急了就没味。"\n我蹲在路边等它化，等了二十分钟，手上冻得发红。\n最后一口咬下去，甜得我差点哭。',
    cause: '它在路边等一颗冻梨化开',
    reply: [
      { text: '等二十分钟，值了', trait: 'calm', memory: { value_slow: 1 } },
      { text: '下次戴手套', trait: 'empathy', memory: { care_beast: 1 } },
      { text: '带一个回来给我', trait: 'food', memory: { keep_item: 1 } }
    ]
  },

  /* ================= 泉州（新城市） ================= */
  {
    id: 'ev-quanzhou-port', city: 'quanzhou', beast: '*', tags: ['water', 'history', 'travel'], weight: 11,
    title: '宋元的潮水', souvenir: 'sou-sea-pearl', insight: 2,
    body: '退潮的时候，泥滩里露出一根斜插着的木船肋骨。\n守港的老人说，七百年前，这里停着从大食和南洋来的帆船，装满香料和瓷器。\n他弯腰捡起一枚被海浪磨圆的青瓷片，递给我看。\n海这么大，可每一道波浪都记着回岸的路。',
    cause: '它去了泉州古港看潮',
    reply: [
      { text: '海风里的旧事真好听', trait: 'scholar', memory: { ask_history: 1 } },
      { text: '替我也听听海浪声', trait: 'calm', memory: { stay_longer: 1 } },
      { text: '你也想去海的那头看看吗', trait: 'brave', memory: { brave: 1 } }
    ]
  },
  {
    id: 'ev-quanzhou-ship', city: 'quanzhou', beast: '*', tags: ['craft', 'travel'], weight: 10,
    title: '不系钉子的船', souvenir: 'sou-brick-ship', insight: 2,
    body: '在老巷深处看见一位造船匠，做的却是巴掌大的木船模型。\n他说泉州福船的船底是尖的，隔舱是水密的——破了一格，整条船也不会沉。\n"人活一辈子也是一样，"他用砂纸磨着船舷说，"心里得有几格隔舱。"',
    cause: '它拜访了泉州福船工坊',
    reply: [
      { text: '心里留几格隔舱，说得好', trait: 'empathy', memory: { understand_others: 1 } },
      { text: '请教他隔舱怎么拼', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '请他做一艘小船带回来', trait: 'food', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-quanzhou-street', city: 'quanzhou', beast: '*', tags: ['food', 'social'], weight: 9,
    title: '半城烟火半城仙', souvenir: 'sou-lantern', insight: 1,
    body: '上午刚在红砖古厝前看过神明出巡的木偶戏，转身就在街角喝到一碗四果汤。\n摊主阿姨往里面舀石花膏、阿达子、莲子和西瓜，满满一大碗。\n我问这里为什么神庙和茶摊挨得这么近。\n她说："神明看着人间，也爱看大家吃得香。"',
    cause: '它在泉州西街喝了一碗四果汤',
    reply: [
      { text: '神明大概也馋这一口', trait: 'food', memory: { enjoy_now: 1 } },
      { text: '问问木偶戏演的哪一出', trait: 'scholar', memory: { ask_story: 1 } },
      { text: '多在街角坐一会儿', trait: 'calm', memory: { slow_down: 1 } }
    ]
  },

  /* ================= 大理（新城市） ================= */
  {
    id: 'ev-dali-wind', city: 'dali', beast: '*', tags: ['nature', 'quiet'], weight: 11,
    title: '下关的风', souvenir: 'sou-wind-flower', insight: 2,
    body: '刚进城，帽子差点被吹进洱海。\n街边卖烤乳扇的大姐笑得直拍围裙："大理的风啊，是专门帮人把愁吹散的。"\n我蹲在岸边看了半天云，苍山顶上的雪纹丝不动，湖面的云却跑得比高铁还快。',
    cause: '它站在洱海边吹了半天风',
    reply: [
      { text: '把烦恼也吹给风吧', trait: 'calm', memory: { slow_down: 1 } },
      { text: '烤乳扇是什么味道的', trait: 'food', memory: { ask_taste: 1 } },
      { text: '拍一张云跑的样子回来', trait: 'scholar', memory: { look_out: 1 } }
    ]
  },
  {
    id: 'ev-dali-tiedye', city: 'dali', beast: '*', tags: ['craft', 'nature'], weight: 10,
    title: '水缸里的云', souvenir: 'sou-tie-dye', insight: 2,
    body: '在周城院子里看见一口大染缸，板蓝根发酵出深不见底的靛青。\n染布的婆婆把白布捏出褶子、拿棉线扎紧，沉进缸里又捞起。\n拆线那一刻，蓝布上忽然开出一朵朵晕染的白花——像把天上的云按进了布里。',
    cause: '它在周城学了扎染',
    reply: [
      { text: '把这朵云带回来', trait: 'calm', memory: { keep_item: 1 } },
      { text: '问问婆婆扎了多少年', trait: 'empathy', memory: { ask_story: 1 } },
      { text: '下次我也试试自己扎一朵', trait: 'brave', memory: { try_new: 1 } }
    ]
  },
  {
    id: 'ev-dali-star', city: 'dali', beast: '*', tags: ['star', 'night'], weight: 9,
    title: '洱海捞星', souvenir: 'sou-star-chart', insight: 2,
    body: '深夜的喜洲稻田安静极了，远处的白族村落亮着几盏温柔的黄灯。\n水田里倒映着半天星斗，我伸爪去碰了一下，整片银河就碎成千百条银鱼。\n等水波平了，星星又一寸寸拼回来。',
    cause: '它在喜洲夜田里看星倒影',
    reply: [
      { text: '碎了也能拼回来，真好', trait: 'empathy', memory: { value_endure: 1 } },
      { text: '画在手账里别忘了', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '下次带大家一起去露营', trait: 'brave', memory: { bring_friend: 1 } }
    ]
  },

  /* ================= 事件链 1：白泽与钢铁巨龙 ================= */
  {
    id: 'ev-chain-train-1', city: 'xian', beast: 'baize', chain: { id: 'ch_train', step: 1 },
    tags: ['travel', 'history', 'scholar'], weight: 26,
    title: '铁甲异兽考', souvenir: 'sou-train-sketch', insight: 2,
    memory: { set: { ch_train: 1 } },
    body: '我在城墙上看见一头铁甲巨兽，长数百丈，腹中载人，日行千里而不喘。\n遍查古籍，未见此物。\n按《山海经》体例，我给它暂定名为"铁龙"，并画了速写一张。\n笔法不精，请见谅。',
    cause: '白泽第一次见到高铁',
    reply: [
      { text: '它叫高铁，不是兽', trait: 'scholar', memory: { explain_train: 1 } },
      { text: '画得很好，继续研究', trait: 'brave', memory: { encourage: 1 } },
      { text: '别急着下结论，再看看', trait: 'calm', memory: { encourage: 1 } }
    ]
  },
  {
    id: 'ev-chain-train-2', city: ['suzhou', 'hangzhou'], beast: 'baize', chain: { id: 'ch_train', step: 2 },
    requires: { memory: { ch_train: 1 } }, tags: ['travel', 'scholar'], weight: 34,
    title: '铁龙辨向考', souvenir: 'sou-postcard', insight: 2,
    memory: { set: { ch_train: 2 } },
    body: '今日又遇铁龙，已知其名为"高铁"。\n然有一事不解：如此庞然之物，山中无路，云中无迹，它如何辨认方向？\n我向一位乘客请教，他说："有轨道。"\n我又问："轨道是谁定的？"\n他想了很久，说："很多人，很多年。"',
    cause: '白泽的疑问从"它是什么"变成了"它怎么认路"',
    reply: [
      { text: '很多人很多年，是最好的答案', trait: 'empathy', memory: { value_ordinary: 1 } },
      { text: '要不要买张铁路图研究', trait: 'scholar', memory: { buy_map: 1 } },
      { text: '你开始像个学者了', trait: 'brave', memory: { encourage: 1 } }
    ]
  },
  {
    id: 'ev-chain-train-3', city: ['harbin', 'dunhuang'], beast: 'baize', chain: { id: 'ch_train', step: 3 },
    requires: { memory: { ch_train: 2 } }, tags: ['travel', 'scholar'], weight: 40,
    title: '日行千里', souvenir: 'sou-rail-map', insight: 3,
    memory: { set: { ch_train: 3 } },
    worldFlag: 'has_rail_notes',
    body: '我买了一张铁路图，回家挂在墙上。\n从最北到最西，一条线一条线地数，数到半夜。\n上古有乘云之术，我只见过记载，从未见过人用它送一封信。\n如今人间虽无乘云之术，却自有日行千里的办法。\n——此条补入《新山海经·交通部》。',
    cause: '白泽把研究做成了自己的铁路手册',
    reply: [
      { text: '挂在家里吧，我帮你腾地方', trait: 'calm', memory: { keep_item: 1 } },
      { text: '下一站想去哪', trait: 'brave', memory: { ask_next: 1 } },
      { text: '你写的这一句，比古籍好', trait: 'empathy', memory: { encourage: 1 } }
    ]
  },

  /* ================= 事件链 2：青鸟与不再写信的人 ================= */
  {
    id: 'ev-chain-letter-1', city: 'suzhou', beast: 'qingniao', chain: { id: 'ch_letter', step: 1 },
    tags: ['letter', 'quiet', 'empathy'], weight: 26,
    title: '门前坐了很久的人', souvenir: 'sou-postcard', insight: 2,
    memory: { set: { ch_letter: 1 } },
    body: '今天见到一位老奶奶，在门前坐了很久。\n她说，以前每年都能收到远方的信，如今大家都用手机了。\n我说，我却是从前替人送信的。\n她笑了，说："那你失业啦？"\n我想了想，好像是。',
    cause: '青鸟遇见了一位等信的老人',
    reply: [
      { text: '寄给她一张明信片吧', trait: 'empathy', memory: { send_card: 1 } },
      { text: '也许你可以听听她以前的故事', trait: 'calm', memory: { ask_story: 1 } },
      { text: '你自己也可以试试手机', trait: 'brave', memory: { try_phone: 1 } }
    ]
  },
  {
    id: 'ev-chain-letter-2', city: ['hangzhou', 'chengdu'], beast: 'qingniao', chain: { id: 'ch_letter', step: 2 },
    requires: { memory: { ch_letter: 1 } }, tags: ['letter', 'empathy'], weight: 34,
    title: '一张画', souvenir: 'sou-rain-bottle', insight: 2,
    memory: { set: { ch_letter: 2 } },
    body: '今天有个小孩，把一张画塞到我翅膀里。\n画上是太阳、房子和三个歪歪扭扭的人。\n他说："想寄给奶奶。"\n我问："为什么不发手机？"\n他说："画太大了，手机装不下。"\n我带着这张画飞了一整天。',
    cause: '有人托青鸟带一张画',
    reply: [
      { text: '一定要送到', trait: 'brave', memory: { promise_deliver: 1 } },
      { text: '问问他奶奶住哪', trait: 'scholar', memory: { ask_story: 1 } },
      { text: '画得真好', trait: 'empathy', memory: { comfort_others: 1 } }
    ]
  },
  {
    id: 'ev-chain-letter-3', city: ['harbin', 'xian'], beast: 'qingniao', chain: { id: 'ch_letter', step: 3 },
    requires: { memory: { ch_letter: 2 } }, tags: ['letter', 'empathy'], weight: 40,
    title: '我还有许多地方可以去', souvenir: 'sou-handbook', insight: 3,
    memory: { set: { ch_letter: 3 } },
    worldFlag: 'has_handbook',
    body: '从前我替神仙传递书信，觉得世间没有比我飞得更快的信使。\n后来人们有了电话，有了网络，似乎再也不需要我了。\n可今日有个小孩，把一张画交给我，说想寄给远方的奶奶。\n我忽然觉得，我还有许多地方可以去。\n——不是因为没有我不行。是因为有些话，值得用飞的。',
    cause: '青鸟找到了继续飞的理由',
    reply: [
      { text: '那就一直飞下去吧', trait: 'brave', memory: { encourage: 1 } },
      { text: '什么时候回来看看我', trait: 'empathy', memory: { ask_back: 1 } },
      { text: '我也有话想让你带', trait: 'calm', memory: { write_back: 1 } }
    ]
  },

  /* ================= 事件链 3：九尾狐与人间美味 ================= */
  {
    id: 'ev-chain-food-1', city: 'chengdu', beast: 'jiuweihu', chain: { id: 'ch_food', step: 1 },
    tags: ['food', 'night', 'social'], weight: 26,
    title: '夜市探险', souvenir: 'sou-hotpot-token', insight: 1,
    memory: { set: { ch_food: 1 } },
    body: '今晚去了夜市！灯全是红的，人比星星多。\n我从街头吃到街尾，第七家的时候开始后悔，第十家的时候决定不后悔。\n有个摊主看我吃得太认真，多给了我一根。\n人间的人真好，看你吃得香就高兴。',
    cause: '九尾狐第一次逛夜市',
    reply: [
      { text: '别吃坏了肚子', trait: 'empathy', memory: { care_beast: 1 } },
      { text: '哪家最好吃', trait: 'food', memory: { ask_focus: 1 } },
      { text: '带一份回来', trait: 'calm', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-chain-food-2', city: ['xian', 'harbin'], beast: 'jiuweihu', chain: { id: 'ch_food', step: 2 },
    requires: { memory: { ch_food: 1 } }, tags: ['food', 'social'], weight: 34,
    title: '带朋友一起吃', souvenir: 'sou-chili', insight: 2,
    memory: { set: { ch_food: 2 } },
    body: '这次带了个路上认识的朋友一起去吃。\n他不吃辣，我说"一点点没关系"，结果他喝了三碗水。\n他一边喝水一边说："下次还来。"\n人间交朋友，好像就是从"下次还来"开始的。',
    cause: '九尾狐带了朋友一起去吃',
    reply: [
      { text: '下次别骗人吃辣了', trait: 'empathy', memory: { comfort_others: 1 } },
      { text: '这个朋友叫什么', trait: 'scholar', memory: { ask_name: 1 } },
      { text: '带他回来做客', trait: 'food', memory: { bring_friend: 1 } }
    ]
  },
  {
    id: 'ev-chain-food-3', city: ['suzhou', 'hangzhou', 'dunhuang'], beast: 'jiuweihu',
    chain: { id: 'ch_food', step: 3 },
    requires: { memory: { ch_food: 2 } }, tags: ['food', 'record'], weight: 40,
    title: '蜀中食录', souvenir: 'sou-handbook', insight: 3,
    memory: { set: { ch_food: 3 } },
    worldFlag: 'has_food_notes',
    body: '我做了一本册子，把吃过的地方都记下来。\n不是记哪家好吃——好吃是记不住的。\n我记的是：谁带我去的，谁多给了我一根，谁被辣哭了还说明天还来。\n上古的书里，从来不写这些。\n可我觉得，这才是人间最好吃的部分。',
    cause: '九尾狐开始记录与人有关的事',
    reply: [
      { text: '这一本我要收好', trait: 'calm', memory: { keep_item: 1 } },
      { text: '下一站想吃什么', trait: 'food', memory: { ask_next: 1 } },
      { text: '你长大了', trait: 'empathy', memory: { encourage: 1 } }
    ]
  },

  /* ================= 事件链 4：精卫与山海工匠 ================= */
  {
    id: 'ev-chain-jingwei-1', city: 'quanzhou', beast: 'jingwei', chain: { id: 'ch_jingwei', step: 1 },
    tags: ['water', 'history', 'travel'], weight: 28,
    title: '桥墩上的牡蛎壳', souvenir: 'sou-sea-pearl', insight: 2,
    memory: { set: { ch_jingwei: 1 } },
    body: '我去了宋代留下的洛阳桥。\n石头沉在海底千年不散，讲解牌上写着，古人往海里养满牡蛎，让贝壳自己把散石粘成一座整礁。\n我叼着一粒西山小石子站在桥头，愣了很久。\n原来不用把海填平，也能让人安稳走过风浪。',
    cause: '精卫看见了以蛎固基的古桥',
    reply: [
      { text: '万物借力，比死磕更聪明', trait: 'scholar', memory: { link_ancient: 1 } },
      { text: '你叼石子累不累', trait: 'empathy', memory: { care_beast: 1 } },
      { text: '把那粒小石子也留着吧', trait: 'calm', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-chain-jingwei-2', city: ['xian', 'dunhuang'], beast: 'jingwei', chain: { id: 'ch_jingwei', step: 2 },
    requires: { memory: { ch_jingwei: 1 } }, tags: ['desert', 'history'], weight: 36,
    title: '沙海里的格子', souvenir: 'sou-sand-vial', insight: 2,
    memory: { set: { ch_jingwei: 2 } },
    body: '沙漠里风沙极大，铁路旁却铺着一望无际的麦草方格。\n治沙的大叔说，一根草拦不住风，一万个一米见方的草格就能把沙丘摁住。\n我想起我衔过那么多年微木——如果我不是一个人在飞呢？',
    cause: '精卫看见了沙漠里的草方格',
    reply: [
      { text: '驿站一直都在你身后', trait: 'empathy', memory: { belong: 1 } },
      { text: '记下这种草格子的尺寸', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '我们一起看海看山', trait: 'brave', memory: { bring_me: 1 } }
    ]
  },
  {
    id: 'ev-chain-jingwei-3', city: ['quanzhou', 'dali'], beast: 'jingwei', chain: { id: 'ch_jingwei', step: 3 },
    requires: { memory: { ch_jingwei: 2 } }, tags: ['water', 'travel', 'record'], weight: 42,
    title: '山海非敌', souvenir: 'sou-compass', insight: 3,
    memory: { set: { ch_jingwei: 3 } },
    worldFlag: 'has_sea_notes',
    body: '从前我衔石填海，是因为恨海无情。\n今日站在海港边看货轮驶过跨海大桥，潮声还是那么响，风还是那么咸，可人们在浪上建起了灯塔，在礁石旁织出了航线。\n我把最后一粒西山石子投进海里——不是为了填平它，是问一声好。',
    cause: '精卫与东海和解了',
    reply: [
      { text: '往后的路，轻装去飞吧', trait: 'calm', memory: { slow_down: 1 } },
      { text: '我替你记在《新山海经》里', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '回来吃块热桂花糕', trait: 'food', memory: { care_back: 1 } }
    ]
  },

  /* ================= 回声事件（玩家回信的真实蝴蝶效应） ================= */
  {
    id: 'ev-echo-window', city: '*', beast: '*', tags: ['quiet', 'record'],
    requires: { memory: { look_out: 1 } }, echo: true, weight: 10,
    title: '窗外的那条河', souvenir: 'sou-postcard', insight: 2,
    body: '照你说的，这次我一直在看窗外。\n原来铁屋子会穿过一条很长的河。河上有很多桥，每一座都不一样。\n有一座桥上站着个人，举着手机拍河。我忽然明白了：他也在看窗外。\n我把看到的都画下来了，一共四座桥。',
    cause: '它听你的话，一直看着窗外',
    reply: [
      { text: '四座桥都寄给我', trait: 'calm', memory: { keep_item: 1 } },
      { text: '下次数数有多少座', trait: 'scholar', memory: { ask_focus: 1 } },
      { text: '你也画进手账里', trait: 'empathy', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-echo-stranger', city: '*', beast: '*', tags: ['social', 'letter'],
    requires: { memory: { talk_stranger: 1 } }, echo: true, weight: 10,
    title: '邻座的人', souvenir: 'sou-postcard', insight: 2,
    body: '我跟旁边的人说话了。\n他是个很老的人，说自己年轻时修过很多条路。"每修一条，就少回一次家。"\n我问后悔吗。他说不后悔，又说，如果重来一次，也许会少修一条。\n到站的时候他拍了拍我。我不知道该说什么，就说了句"路上小心"。',
    cause: '你让它跟旁边的人说句话',
    reply: [
      { text: '你说得很好', trait: 'empathy', memory: { encourage: 1 } },
      { text: '问问他修过哪条路', trait: 'scholar', memory: { ask_story: 1 } },
      { text: '这份心情要记下来', trait: 'calm', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-echo-brave', city: '*', beast: '*', tags: ['city', 'playful'],
    requires: { memory: { brave: 1 } }, echo: true, weight: 10,
    title: '走到顶', souvenir: 'sou-postcard', insight: 1,
    body: '这次我走到顶了。\n原来台阶的尽头是一个巨大的屋子，屋顶是透明的，阳光整片洒下来。\n很多人在上面走，谁也没跳下来。\n我想：上次我跳下来六次，其实只需要多站一会儿。',
    cause: '你说"再试一次，这次走到顶"',
    reply: [
      { text: '下次带你去更高的地方', trait: 'brave', memory: { encourage: 1 } },
      { text: '屋顶上看见什么了', trait: 'scholar', memory: { ask_focus: 1 } },
      { text: '你变勇敢了', trait: 'empathy', memory: { encourage: 1 } }
    ]
  },
  {
    id: 'ev-echo-umbrella', city: '*', beast: '*', tags: ['rain', 'quiet'],
    requires: { memory: { bring_umbrella: 1 } }, echo: true, weight: 12,
    title: '伞下的路', souvenir: 'sou-rain-bottle', insight: 2,
    weather: 'rain',
    body: '这次下雨，我带了伞。\n伞面是桐油的，雨点打上去，声音跟打在别处不一样。\n我撑着伞走得很慢。有个小孩跑过来跟我挤一把，他妈妈在后面喊"谢谢"。\n到路口我们分开了。他说"哥哥再见"。\n我第一次觉得，带一把伞不只是为了不淋湿。',
    cause: '你说"下次带把伞"',
    reply: [
      { text: '伞要常带', trait: 'calm', memory: { bring_umbrella: 1 } },
      { text: '那个小孩很可爱', trait: 'empathy', memory: { notice_child: 1 } },
      { text: '下次也给我撑一次', trait: 'food', memory: { bring_me: 1 } }
    ]
  },
  {
    id: 'ev-echo-card', city: '*', beast: ['qingniao', 'jiuweihu', 'jingwei'], tags: ['letter', 'empathy'],
    requires: { memory: { send_card: 1 } }, echo: true, weight: 12,
    title: '明信片寄到了', souvenir: 'sou-silk', insight: 2,
    body: '我寄出去的明信片，收到了回音。\n老奶奶托人捎话：孙女收到那天，哭了。\n她说孙女把明信片贴在了书桌前，说"这是神仙寄的"。\n其实不是神仙。是一只失业的鸟。\n可这句话，我想记一辈子。',
    cause: '你说"寄给她一张明信片吧"',
    reply: [
      { text: '这不叫失业，叫转行', trait: 'brave', memory: { encourage: 1 } },
      { text: '再给她寄一张', trait: 'empathy', memory: { send_card: 1 } },
      { text: '你自己也该高兴一点', trait: 'calm', memory: { care_beast: 1 } }
    ]
  },
  {
    id: 'ev-echo-story', city: '*', beast: '*', tags: ['quiet', 'empathy'],
    requires: { memory: { ask_story: 1 } }, echo: true, weight: 10,
    title: '她以前的故事', souvenir: 'sou-postcard', insight: 2,
    body: '我按你说的，去听她讲故事了。\n她讲了四十分钟，讲她年轻时在纺织厂，讲她老伴追她时送了三斤苹果。\n讲到最后她说："这些事，我老伴走了以后就没讲过。"\n我说：您讲，我记着呢。\n回来我把记得的都写下来了，一共七页。',
    cause: '你说"去问问她们为什么天天来"',
    reply: [
      { text: '七页我都要看', trait: 'empathy', memory: { ask_together: 1 } },
      { text: '以后常去听', trait: 'calm', memory: { ask_story: 1 } },
      { text: '她讲的这些，值得写进书里', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-echo-light', city: '*', beast: '*', tags: ['night', 'quiet'],
    requires: { memory: { keep_light: 1 } }, echo: true, weight: 10,
    title: '给你的那盏灯', souvenir: 'sou-lantern', insight: 2,
    body: '我记得你说过，回来给我留一盏灯。\n所以这次我也买了一盏，很小的，装在瓶子里。\n我在夜里把它点上，放在窗台上。我对自己说：这是给那边那个人的。\n你大概看不见。可我知道它亮着。',
    cause: '你说"回来也给你留一盏"',
    reply: [
      { text: '我看见了', trait: 'empathy', memory: { keep_light: 1 } },
      { text: '你也早点睡', trait: 'calm', memory: { care_beast: 1 } },
      { text: '这盏灯要一直留着', trait: 'scholar', memory: { value_endure: 1 } }
    ]
  },
  {
    id: 'ev-echo-teach', city: 'xian', beast: '*', tags: ['food', 'social'],
    requires: { memory: { teach_back: 1 } }, echo: true, weight: 10,
    title: '还他一点本事', souvenir: 'sou-hotpot-token', insight: 2,
    body: '我找到那位教我掰泡馍的大爷了。\n这次我带了自己做的桂花糕，教他怎么分辨桂花的品种。\n他学得很认真，还拿小本子记了。\n他说："掰馍我教了你四十分钟，你这个我也学四十分钟。"\n我们扯平了。',
    cause: '你说"下次教他点你的本事"',
    reply: [
      { text: '扯平了，真好', trait: 'empathy', memory: { comfort_others: 1 } },
      { text: '下次教他更多', trait: 'food', memory: { teach_back: 1 } },
      { text: '把这也记下来', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-echo-phone', city: '*', beast: '*', tags: ['city', 'letter'],
    requires: { memory: { try_phone: 1 } }, echo: true, weight: 10,
    title: '它试着打了电话', souvenir: 'sou-postcard', insight: 2,
    body: '我借了一部手机，试着给你打了个电话。\n你没接。我听到了一段很奇怪的声音，说什么"您拨打的用户正忙"。\n我想：千里传音，果然也不是什么时候都能通的。\n后来我给你发了一条短信。只有两个字：在吗。',
    cause: '你说"你自己也可以试试手机"',
    reply: [
      { text: '我看到了，在的', trait: 'empathy', memory: { call_me: 1 } },
      { text: '以后想我就打给我', trait: 'brave', memory: { encourage: 1 } },
      { text: '短信我存下来了', trait: 'calm', memory: { keep_item: 1 } }
    ]
  },
  {
    id: 'ev-echo-promise', city: '*', beast: 'qingniao', tags: ['letter', 'empathy'],
    requires: { memory: { promise_deliver: 1 } }, echo: true, weight: 12,
    title: '画送到了', souvenir: 'sou-handbook', insight: 2,
    body: '那张画，我送到奶奶手里了。\n她住在很远的地方，我飞了三天。\n她接过画的时候，手在抖。她说："这是我家小宝画的。"\n她在门口站了很久，一直看那三个歪歪扭扭的人。\n我说：画太大了，手机装不下。她笑了，说："对，装不下。"',
    cause: '你说"一定要送到"',
    reply: [
      { text: '你做到了', trait: 'brave', memory: { encourage: 1 } },
      { text: '飞了三天，累不累', trait: 'empathy', memory: { care_beast: 1 } },
      { text: '把这件事写下来', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-echo-knock', city: 'suzhou', beast: '*', tags: ['rain', 'quiet'],
    requires: { memory: { knock_door: 1 } }, echo: true, weight: 10,
    title: '我敲了门', souvenir: 'sou-paper-umbrella', insight: 2,
    weather: 'rain',
    body: '又下雨，我又拐进那条巷子。\n灯下还是有人在剥豆子。这次我敲了门。\n她给我搬了个小板凳，倒了杯热水，什么也没问。\n我坐到雨停。走的时候她说："下次落雨还来。"\n我说好。我已经有了一条可以回去的巷子。',
    cause: '你说"敲敲门，问问能不能进屋"',
    reply: [
      { text: '下次带我一起去', trait: 'food', memory: { bring_me: 1 } },
      { text: '给她带点桂花糕', trait: 'empathy', memory: { keep_item: 1 } },
      { text: '有可以回去的地方，真好', trait: 'calm', memory: { value_endure: 1 } }
    ]
  },

  /* ================= 世界状态联动 ================= */
  {
    id: 'ev-world-rail', city: '*', beast: ['jiuweihu', 'qingniao', 'jingwei'], tags: ['travel', 'record'],
    requires: { worldFlag: 'has_rail_notes' }, weight: 12,
    title: '翻出白泽的手稿', souvenir: 'sou-postcard', insight: 2,
    body: '路上迷路了。我想起家里挂着的那张铁路图，就照着记忆画了一份。\n居然真的对上了。\n白泽那家伙，平时闷得很，画起图来倒是一点不含糊。\n回去得跟它说一声：你那张图，有用。',
    cause: '家里挂着的铁路手册派上了用场',
    reply: [
      { text: '替我谢谢它', trait: 'empathy', memory: { thank_friend: 1 } },
      { text: '你们可以一起研究', trait: 'scholar', memory: { bring_friend: 1 } },
      { text: '记得在图上补一笔', trait: 'calm', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-world-handbook', city: '*', beast: '*', tags: ['record', 'scholar'],
    requires: { worldFlag: 'has_handbook' }, weight: 12,
    title: '观察笔记的新一页', souvenir: 'sou-postcard', insight: 2,
    body: '我带着家里那本《现代人间观察笔记》出门，边走边补。\n今天新增三条：会自己开的门、会说话的柱子、给人让路的车。\n第四条写了一半——"为什么人要在公园里对着树站着？"\n留着，下次再想。',
    cause: '带着家里的观察笔记出门',
    reply: [
      { text: '第四条我也不知道', trait: 'calm', memory: { ask_together: 1 } },
      { text: '慢慢写，不着急', trait: 'empathy', memory: { slow_down: 1 } },
      { text: '这本以后要传下去', trait: 'scholar', memory: { value_endure: 1 } }
    ]
  },
  {
    id: 'ev-world-food', city: '*', beast: ['baize', 'qingniao', 'jingwei'], tags: ['food', 'record'],
    requires: { worldFlag: 'has_food_notes' }, weight: 12,
    title: '照着食录找吃的', souvenir: 'sou-postcard', insight: 2,
    body: '出门前偷看了九尾狐的《蜀中食录》。\n它写得极细，连"第几家的辣椒要少放"都标了出来。\n我照着去了一家，辣得眼睛发红，还是吃完了。\n回来在页边补了一句：以上均为狐言，尽信之则辣。',
    cause: '照着九尾狐的食录去觅食',
    reply: [
      { text: '它写的你也敢全信', trait: 'food', memory: { comfort_others: 1 } },
      { text: '下次一起去', trait: 'empathy', memory: { bring_friend: 1 } },
      { text: '这句批注写得好', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },

  /* ================= 后天性格印记 · 反差萌专属奇遇 ================= */
  {
    id: 'ev-quirk-baize-food', city: 'chengdu', beast: 'baize',
    requires: { quirk: 'quirk-gourmet' }, tags: ['food', 'night', 'scholar'], weight: 28,
    title: '《红汤百味考》', souvenir: 'sou-chili', insight: 3,
    body: '自从佩了「夜市老饕」印记，我在春熙路夜市竟也坐得住了。\n按《山海经》体例考据：红油锅沸如赤水，毛肚七上八下谓之"礼数"，冰粉甘凉可镇丹火。\n邻桌小伙问我写论文吗，我说不是，这是正经食经。',
    cause: '白泽带着「夜市老饕」印记钻进了成都夜市',
    reply: [
      { text: '这是我见过最正经的吃货笔记', trait: 'food', memory: { ask_taste: 1 } },
      { text: '记得点微辣就行', trait: 'empathy', memory: { care_beast: 1 } },
      { text: '补入《新山海经·食货志》', trait: 'scholar', memory: { record_habit: 1 } }
    ]
  },
  {
    id: 'ev-quirk-fox-scholar', city: 'xian', beast: 'jiuweihu',
    requires: { quirk: 'quirk-collator' }, tags: ['history', 'scholar'], weight: 28,
    title: '狐狸校对碑林', souvenir: 'sou-terracotta', insight: 3,
    body: '以前我觉得石头有什么好看的，今天戴上「古籍校勘」印记进了碑林，居然看入迷了。\n我趴在一块唐代石碑前，用尾巴扫开落叶，一个字一个字地对偏旁。\n旁边老教授夸我："这小友眼神真毒。"——其实我只是饿了想找"鱼"字旁的字。',
    cause: '九尾狐佩着「古籍校勘」印记进了碑林',
    reply: [
      { text: '找着几个带鱼字旁的字了', trait: 'food', memory: { ask_focus: 1 } },
      { text: '算你认认真真逛了回古迹', trait: 'scholar', memory: { encourage: 1 } },
      { text: '下次跟白泽比试认字', trait: 'brave', memory: { bring_friend: 1 } }
    ]
  },
  {
    id: 'ev-quirk-rainlistener', city: ['suzhou', 'hangzhou'], beast: '*',
    requires: { quirk: 'quirk-rainlistener' }, tags: ['rain', 'quiet'], weight: 24,
    title: '瓦檐四重奏', souvenir: 'sou-rain-bottle', insight: 2,
    body: '我在青石板巷口听了一整场梅雨。\n雨打芭蕉是钝鼓，滴进铜盆是清磬，顺着瓦当溜进暗渠是急弦。\n等雨停了，阿婆开窗送了我一把刚摘的栀子花，说看我听得比戏迷还入神。',
    cause: '「檐下听雨人」心境引来了江南深巷的雨声',
    reply: [
      { text: '把这瓶雨声也封存起来', trait: 'calm', memory: { love_rain: 1 } },
      { text: '栀子花香吗', trait: 'empathy', memory: { keep_item: 1 } },
      { text: '回来唱给我听听看', trait: 'food', memory: { bring_me: 1 } }
    ]
  },
  {
    id: 'ev-quirk-starwatcher', city: ['dunhuang', 'dali'], beast: '*',
    requires: { quirk: 'quirk-starwatcher' }, tags: ['star', 'scholar'], weight: 24,
    title: '星官名录补遗', souvenir: 'sou-star-chart', insight: 3,
    body: '夜深万籁俱寂时，我把二十八宿与现代望远镜里的星云图叠在一起看。\n古人把几颗微星连成一只神兽的轮廓，如今人们知道那是几万光年外的太阳。\n距离变大了，可抬头看同一片暗夜时，心里的悸动一点没变。',
    cause: '「观星拾遗」印记让它看得更深远了',
    reply: [
      { text: '光年和千里，一样浪漫', trait: 'empathy', memory: { love_romance: 1 } },
      { text: '这张星图太珍贵了', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '多披件衣裳看星星', trait: 'calm', memory: { care_beast: 1 } }
    ]
  },
  {
    id: 'ev-quirk-pioneer', city: ['quanzhou', 'harbin'], beast: '*',
    requires: { quirk: 'quirk-pioneer' }, tags: ['travel', 'water', 'snow'], weight: 24,
    title: '潮头立羽', souvenir: 'sou-compass', insight: 3,
    body: '天没亮我就出发了，去往地图最边缘的码头。\n海风吹得耳朵生疼，可当第一艘早班渡轮拉响汽笛劈开雾气时，忽然觉得人间从不缺敢往未知处走的人。\n船长冲我按了三下短笛，算作打过招呼。',
    cause: '「破浪问津」的步履带它走向更远的地方',
    reply: [
      { text: '我也替你回敬三声风铃', trait: 'brave', memory: { encourage: 1 } },
      { text: '记住那一声汽笛', trait: 'scholar', memory: { record_habit: 1 } },
      { text: '早晚平安回来', trait: 'empathy', memory: { care_back: 1 } }
    ]
  },
  {
    id: 'ev-quirk-teadrinker', city: ['hangzhou', 'dali', 'chengdu'], beast: '*',
    requires: { quirk: 'quirk-teadrinker' }, tags: ['tea', 'quiet'], weight: 24,
    title: '三道茶的讲究', souvenir: 'sou-longjing', insight: 2,
    body: '老茶客让我喝三道茶：第一道苦茶醒神，第二道甜茶留甘，第三道回味茶加了桂皮与蜂蜜。\n他说："头口苦莫皱眉，二口甜莫贪嘴，三口回味才知这辈子没白走。"\n我端着茶碗，差点把鼻子凑进茶沫里。',
    cause: '「竹炉煎茶客」寻到了三道茶的好味',
    reply: [
      { text: '第一口苦我也陪你喝', trait: 'empathy', memory: { ask_together: 1 } },
      { text: '带些好茶回驿站', trait: 'food', memory: { keep_item: 1 } },
      { text: '三道茶也是做人的学问', trait: 'calm', memory: { value_slow: 1 } }
    ]
  },

  /* ================= 节气限定与稀有道具互动 ================= */
  {
    id: 'ev-item-compass', city: ['dunhuang', 'quanzhou', 'dali'], beast: '*',
    requires: { item: 'compass' }, tags: ['travel', 'star', 'history'], weight: 24,
    title: '司南指处有旧踪', souvenir: 'sou-compass', insight: 3,
    body: '行囊里的「西域司南」突然自己转了半圈，停在老城一条无人问津的砖巷口。\n我顺着方向走过去，竟撞见一座藏在老槐树后面的旧书铺，老板正在晾晒民国年间的线装地图。\n他说："这东西等有缘的客人等了二十年。"',
    cause: '「西域司南」感应到了旧物所在',
    reply: [
      { text: '原来司南真的认路', trait: 'brave', memory: { brave: 1 } },
      { text: '问老板借一张老地图看看', trait: 'scholar', memory: { buy_map: 1 } },
      { text: '多和老店主打听故事', trait: 'empathy', memory: { ask_story: 1 } }
    ]
  },
  {
    id: 'ev-item-waxseal', city: '*', beast: '*',
    requires: { item: 'waxseal' }, tags: ['letter', 'empathy'], weight: 22,
    title: '加急飞鸿', souvenir: 'sou-bridge-mark', insight: 2,
    body: '带了你封的「加急火漆」，一路几乎没怎么耽搁就到了邮驿。\n邮局的小哥看见信封角上的朱红火漆印，特地帮我贴了枚最漂亮的纪念邮戳，说现在很少见这么郑重其事寄信的人了。',
    cause: '「加急火漆」护送这封信飞得更快',
    reply: [
      { text: '郑重对待每句话，是驿站的规矩', trait: 'empathy', memory: { write_back: 1 } },
      { text: '那枚邮戳一定好好收着', trait: 'calm', memory: { keep_item: 1 } },
      { text: '下次还给你封加急火漆', trait: 'brave', memory: { encourage: 1 } }
    ]
  },

  /* ================= 新春/秋桂/冬雪节气补充奇遇 ================= */
  {
    id: 'ev-season-spring', city: ['suzhou', 'hangzhou', 'dali'], beast: '*',
    tags: ['nature', 'tea'], weight: 10,
    title: '茶山第一芽', souvenir: 'sou-lotus-pod', insight: 1,
    body: '山坡上的茶树刚刚抽芽，采茶的竹篓里全是鹅黄嫩绿。\n有个小姑娘顺手插了一支野桃花在竹篓边，说这是给山神的见面礼。\n我默默把行囊里的桂花糕留了一块在石台上。',
    cause: '春山新芽初醒',
    reply: [
      { text: '这是山神与人的默契', trait: 'empathy', memory: { link_ancient: 1 } },
      { text: '早春的风还凉吗', trait: 'calm', memory: { care_beast: 1 } },
      { text: '回来煮新茶喝', trait: 'food', memory: { care_back: 1 } }
    ]
  },
  {
    id: 'ev-season-autumn', city: ['xian', 'chengdu', 'hangzhou'], beast: '*',
    tags: ['food', 'nature', 'quiet'], weight: 10,
    title: '糖炒栗子与银杏', souvenir: 'sou-osmanthus', insight: 1,
    body: '一条街的银杏叶落得像铺了金箔，拐角处铁锅里正翻炒着黑砂和栗子。\n焦甜的香气飘了半条街，买栗子的老爷爷多塞给我两颗破了壳、最容易剥的。\n"趁热，"他说，"凉了壳就难剥了。"',
    cause: '秋风把银杏叶和板栗香吹到了一起',
    reply: [
      { text: '趁热吃才最甜', trait: 'food', memory: { enjoy_now: 1 } },
      { text: '捡一片完整的银杏叶做书签', trait: 'calm', memory: { keep_item: 1 } },
      { text: '人间的善意总藏在这些小事里', trait: 'empathy', memory: { value_ordinary: 1 } }
    ]
  }
];

/* ================= 组合式日常短笺模板（确保后期长线绝不死板重复） ================= */
export const DYNAMIC_FRAGMENTS = {
  openings: {
    sunny: ['今天日光透亮，云朵像刚晒过的宣纸一样白。', '天色放晴，风吹过屋檐铜铃叮当作响。'],
    cloudy: ['天有些阴沉，风里却有湿润的草木香。', '云压得很低，街上的行人反倒走得慢了。'],
    rain: ['细雨丝丝缕缕落了一下午，石板路泛着微亮的水光。', '躲在长廊下看雨滴顺着青瓦溜下来，像一串没说完的话。'],
    snow: ['雪花慢悠悠地飘下来，把远处高楼的棱角全磨软了。', '哈出的气在冷空气里化作白雾，踩在雪上咯吱作响。'],
    night: ['华灯初上时，这座城才露出温柔的另一面。', '夜风清凉，便利店与夜市摊的灯一盏接一盏亮起。']
  },
  observations: {
    baize: [
      '我在旧书摊边翻到一本民国地方志，把里面提到的旧桥名与如今的地铁站名一一对上了号。',
      '广场上有位老人拿清水在地面练大字，水干了字也没了，他说写字原就是为了心静。',
      '听见两个年轻人在讨论上古神兽的模样，我差点忍不住插嘴纠正他们的错处。'
    ],
    jiuweihu: [
      '循着香味拐进一条只有两米宽的巷子，居然找到一家藏在居民楼下的手工糖水铺！',
      '小摊前的猫一点也不怕我，还分了我半根烤肠（其实是我用桂花糕跟它换的）。',
      '路边有人吹糖人，眨眼就吹出一只九条尾巴的小狐狸，我买了下来一直举在手里。'
    ],
    qingniao: [
      '看见邮局门口的老邮筒还好好刷着绿漆，里面居然真的躺着几封手写信。',
      '公园长椅上有一对老夫妻安安静静地分吃一个橘子，一句话没说，可我觉着他们聊了很久。',
      '有只麻雀停在红绿灯上跟行人一起等绿灯，人间万物好像都有自己的小规矩。'
    ],
    jingwei: [
      '河岸边工地上灯火通明，工程师说那是给下个十年准备的跨江通道。',
      '我站在人行天桥上数过往的车流，每一盏车灯都在赶往某个等它回家的人身边。',
      '海岸防波堤上停满了一排海鸥，大家排排站着等退潮，秩序井然得像上古水师。'
    ]
  },
  closings: [
    '风把你的嘱咐吹进耳朵里了。等我再转两条街，就启程回驿站。',
    '路上捡了片很好看的叶子夹在信纸里，回去讲给你听。',
    '听说今晚驿站的灯一直亮着，我不赶时间，但也总想着早些回去。',
    '人间这么大，幸好驿站永远替我留着一盏热茶。'
  ]
};

/* ================= 双兽合写家书库 ================= */
export const COAUTHOR_LETTERS = [
  {
    beasts: ['baize', 'jiuweihu'],
    title: '【合写】关于火锅与《礼记》的辩论',
    souvenir: 'sou-hotpot-token',
    body: '【白泽笔】今日于街角遇一奇食，红汤翻沸，百味杂陈，余按古礼考之，疑与古之大鼎共食同源。\n\n【九尾狐抢过笔涂画】别听白泽一本正经掉书袋！它嘴上说着“需考证辣度”，结果自己把整盘脆毛肚全吃光了！还差点把冰粉当成玉露琼浆端走。明天再去吃一次，给你带糖油果子！',
    cause: '白泽与九尾狐在旅途中撞了个满怀，合写了这封信'
  },
  {
    beasts: ['qingniao', 'baize'],
    title: '【合写】旧书铺里的半页夹信',
    souvenir: 'sou-bridge-mark',
    body: '【白泽笔】今日在老书肆查证地方志时，与青鸟不期而遇。在《水经注》残本里竟夹着一页三十年前未寄出的情书。\n\n【青鸟续】店主说书是旧货市场收来的，已找不到原主人。白泽替它校了落款日期，我替它折了一只纸鹤压在书页里。有些心事虽然迟了，被看见就算抵达了吧。',
    cause: '青鸟与白泽在同一间旧书店避雨相遇'
  },
  {
    beasts: ['jiuweihu', 'qingniao'],
    title: '【合写】夜市尽头的明信片摊',
    souvenir: 'sou-postcard',
    body: '【九尾狐笔】我在夜市刚买完烤红薯，一抬头就看见青鸟蹲在路灯顶上发呆！我拿红薯分了它一半，它眼睛一下子就亮了。\n\n【青鸟续】其实是闻着香味自己飞下来的……后来我们一起逛了手绘明信片摊，小狐狸硬要在每张空白处都按一个梅花爪印，说是驿站专属邮戳。',
    cause: '九尾狐把半块烤红薯分给了屋檐上的青鸟'
  },
  {
    beasts: ['jingwei', 'qingniao'],
    title: '【合写】海风与旧邮筒',
    souvenir: 'sou-sea-pearl',
    body: '【精卫笔】在海港防波堤吹风时，远远看见一只青影逆风飞来，原来是青鸟替海员送家信。\n\n【青鸟续】海风很大，精卫替我挡了半程风浪。我们一起坐在灯塔台阶上看货轮进港。两只从山海经里飞出来的鸟，在现代海港边分了一袋海盐花生，觉得这里真好。',
    cause: '精卫与青鸟在海风中并肩飞行了一程'
  },
  {
    beasts: ['jingwei', 'baize'],
    title: '【合写】跨海长桥考',
    souvenir: 'sou-brick-ship',
    body: '【精卫笔】白泽陪我把整座跨海大桥从桥头走到桥尾。我从没想过，原来不需要把海填平，架起柱子也能走过浪头。\n\n【白泽续】精卫全程默不作声，临走时却对着桥墩深深鞠了一躬。我已将此桥建制记入《新山海经·造物卷》，旁注：胜过神力者，人之恒心也。',
    cause: '精卫邀白泽同观跨海大桥'
  },
  {
    beasts: ['jingwei', 'jiuweihu'],
    title: '【合写】海鲜排档里的西山石子',
    souvenir: 'sou-hearth-stone',
    body: '【九尾狐笔】精卫这家伙出门竟然只在包袱里装干粮！被我强行拉进海边大排档点了一整桌蒜蓉生蚝和海蛎煎！\n\n【精卫续】太辣，也很烫……但我全部吃完了。尾巴毛还沾上了葱花的小狐狸笑得在长凳上打滚。人类把海里的鲜味全煮进一口铁锅里，确实比干嚼石子有意思多了。',
    cause: '九尾狐拽着精卫进了海边排档'
  }
];
