Slots的后端简单教学，有过实际上线，前端unity，后端JavaScript
=====
简要说明
-------
    这是一个之前没有借鉴过任何老虎机算法的自实现，子玩法做了拆分不过拆的不好，是用JavaScript写的，运行在微软playfab cloudscript上。
    JavaScript也是摸索着写的，如果觉得写的比较丑陋就将就看吧，我也没打算继续维护这个东西。
    中间各个方法的调用就看自己的能力了，我不知道用JavaScript如何实现向java那种工厂+策略模式，没有那么多时间研究。
重要：不要吐槽玩法和参数的命名，以下内容玩法都是基于playfab自身的api和自编码组合完成，也可以剔除playfab api相关内容自己改成数据库连接(自己去改吧我懒得改了)。方法中为了方便自己用了eval函数，这个就看个人喜欢了喜欢用，这样就算策划改了计算公式也不用改代码了。
-------
* 1.普通任一矩阵连线玩法(方法名CalculationSlotsPrizeLines，下面其他玩法也会套用这个方法毕竟还是连线玩的)
  * 例如6*6矩阵，连线可以有2,3,4,5,6个图片相连(包含万能图标)，同种图片倍数的替换(1倍换N倍)
* 2.个人JackPort奖池计算(方法名GetJackPotPrize)
  * 因个人原因JackPort没有做成多人或者全服奖池，没来得及，玩家没有中连线的情况下会按设定比例增加到JackPort中。
* 3.BaseGame(方法名GetBaseGamePrize)
  * 我也忘记这是啥玩法了，之前策划是这么叫的，我也这么命名了，放了4个月之后我也不记得了。
* 4.FreeGame(方法名GetFreeGamePrize)
  * 好像是个特定连线触发的一个玩法，免费玩X次。
* 5.BonusGame(方法名GetBonusGamePrize)
  * 这个我也忘记了。
* 6.免费一天一次必中连线，按策划给的中奖连线数据出结果，反正很简单(方法名SlotsFree)
  * 蚊子肉也是肉

title-internal-data.json为策划需要编辑的数据，应该是不难理解
-------
* Style 风格类型
  * [3,3,3]意思为从左往右有3条竖轴，每个竖轴都有3个格子。 例如：[5,3,3,5]的意思就是，竖轴1有5个格子，竖轴2有3个格子，竖轴3有3个格子，竖轴4有5个格子这样可以编辑异形矩阵。肯定是有改进方案的，剩下的自己去想吧
* Reels 真实轴数据集合 根据Style的长度来定，例如[3,3,3]，有3条轴你非要写4个轴的数据到Reels里也没用但是不能比3少。
  * 这个应该不用我解释了吧，我这里用的是字符串去代表图片，只要跟前端定好里面的字符串或者数字或者其他也好对应的资源图片就OK了
* WinLinesPosition 中奖线的位置数据集合
  * 显示给用户的格子我按从上到下从左到右分了角标，从0开始。[3,3,3]就会是 轴1的格子角标就是0,1,2 轴2的格子角标就是3,4,5 轴3的就是6,7,8。异形矩阵同理。
* Asset
  * 这个忘记了，代码里找了一下没找到。
* PayTables 一样格子数量的连线给多少奖励的集合
  * 例如这个数据"2 OF A KIND": {"DIAMOND": "5000*Rate"}， 这个就代表2个格子连线并且是2个钻石图片，其他的就自己看吧。
* Universals 万能图片，能在计算连线方法中用来当各种图片
  * 没啥可说的
* NoWin 有这个图片就退出连线计算
  * 连线计算是循环WinLinesPosition的数据，连线里去匹配图片的时候如果有NoWin中的图片就直接退出这条连线的计算，省点时间
* Random 这个是用来替换同种图片倍率的
  * 结构是 "CHIP（图片）": {"Type": "ONCE（不会重复进入）", "Weights": [{"Pattern": "CHIP_", "Weight": 85, "Index": "Low", "Next": {"Type": "ALL","Weights": [{"Pattern": "1", "Weight": 6329}]},数据中Weights是可以循环嵌套的，解这个结构的方法是递归。
* LineBet 玩一次需要的钱
  * 为了排版好看
* DefaultLineIndex 最开始进入该老虎机初始显示的内容
  * [0,0,0]也是对应Style的[3,3,3]，主要表示Reels中轴上的对应轴的图片
* BetMultiplier 可以选择的倍率
  * 这样就可以动态控制倍率了，根据自己的缓存策略，多久更新一次模板数据，就能尽快更新。或者有个http的开关，可以选择立马更新模板数据
* BaseGame，BonusGame，FreeGame
  * 这些玩法呢可以自由组合，可有可无，可以多种组合
  * 这里唯一要注意的是"Condition": [{"Pattern": "SUITCASE", "Formula": "Param>=3"}]，这个数据是用来判断触发条件的，这是一个数组可以多种条件组合。
