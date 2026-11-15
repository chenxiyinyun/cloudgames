/* 回信记忆 → 归因回显文案
   每个 key 对应玩家在回信里说过的一句话。归来时会显示"它记住了什么"，
   让三选一的选择产生可见的因果（P0①：归因全量化）。 */
(function () {
  const SH = window.SH;

  SH.MEMORY_LINES = {
    /* 现代生活初见 */
    look_out: '你说"下次看看窗外"',
    talk_stranger: '你说"跟旁边的人说句话试试"',
    record_habit: '你说"记下来，慢慢想"',
    explain_camera: '你说"那不是精灵，是摄像头"',
    thank_machine: '你说"守夜的东西也值得谢谢"',
    ask_fear: '你问过它"你怕黑吗"',
    talk_kid: '你说"下次跟小孩打个招呼"',
    brave: '你说"再试一次，这次走到顶"',
    value_ordinary: '你说"家常话也值得跑那么远"',
    call_me: '你说"也可以试试给我传音"',
    care_back: '你说"回来我给你泡茶"',
    thank_worker: '你说"跟他说一声辛苦了"',
    understand_others: '你说"他们追的是别人的晚饭"',
    slow_down: '你说"路上慢慢走"',
    join_in: '你说"跳会了教我"',
    ask_story: '你说"去问问她们为什么天天来"',
    stay_watcher: '你说"在旁边看着就好"',
    link_ancient: '你和它聊过"上古的符"',
    explain_gently: '你说"你的理解其实很接近"',
    enjoy_now: '你说"先买点吃的"',
    notice_child: '你问过"他是不是有心事"',
    walk_along: '你说"陪他走到家吧"',
    ask_past: '你问过"你小时候也这样吗"',

    /* 天气 */
    bring_umbrella: '你说"下次带把伞"',
    love_rain: '你问过"雨声好听吗"',
    knock_door: '你说"敲敲门，问问能不能进屋"',
    share_warmth: '你说"把手套给它一只"',
    miss_home: '你问过"雪和青丘的一样吗"',
    stay_longer: '你说"多待一会儿再回来"',
    notice_one: '你问过"哪一格最让你在意"',
    keep_light: '你说"回来也给你留一盏"',

    /* 城市见闻 */
    ask_focus: '你问过它更在意什么',
    value_endure: '你说"还在，就是好事"',
    comfort_beast: '你说"他听见了"',
    ask_history: '你说"回来跟我说说那个皇帝"',
    bring_friend: '你说"下次带朋友一起去"',
    teach_back: '你说"下次教他点你的本事"',
    value_slow: '你说"慢慢来，值得"',
    ask_name: '你问过"他叫什么名字"',
    ask_taste: '你问过"好吃吗"',
    keep_contact: '你说"跟他们要个联系方式"',
    bring_me: '你说"下次带我一起去"',
    comfort_others: '你说"拆过的地方最好看"',
    keep_item: '你说"带回来给我"',
    belong: '你说"没人回头说明你融入了"',
    try_new: '你说"学着试试"',
    love_romance: '你说"这个名字真浪漫"',
    value_change: '你说"每年都不一样，真好"',
    care_beast: '你关心过它"在外面冷吗"',
    ask_together: '你说"下次一起去"',
    ask_promise: '你问过"你会一直叫吗"',

    /* 事件链 */
    explain_train: '你告诉它"那叫高铁，不是兽"',
    encourage: '你一直在鼓励它',
    buy_map: '你说"买张铁路图研究吧"',
    ask_next: '你问过"下一站想去哪"',
    send_card: '你说"寄给她一张明信片吧"',
    try_phone: '你说"你自己也可以试试手机"',
    promise_deliver: '你说"一定要送到"',
    ask_back: '你问过"什么时候回来看看我"',
    write_back: '你说"我也有话想让你带"',
    thank_friend: '你说"替我谢谢它"',

    /* 事件链状态（不单独回显，但保留映射以防误入） */
    ch_train: '它一直在研究那条钢铁长龙',
    ch_letter: '它一直在想那位等信的老人',
    ch_food: '它一直在人间四处找好吃的'
  };
})();
