Slots的后端简单教学，有过实际上线，前端unity，后端JavaScript
=====
简要说明
-------
    这是一个之前没有借鉴过任何老虎机算法的自实现，子玩法做了拆分不过拆的不好，是用JavaScript写的，运行在微软playfab cloudscript上。
    JavaScript也是摸索着写的，如果觉得写的比较丑陋就将就看吧，我也没打算继续维护这个东西。
    中间各个方法的调用就看自己的能力了，我不知道用JavaScript如何实现向java那种工厂+策略模式，没有那么多时间研究。
重要：不要吐槽玩法和参数的命名，以下内容玩法都是基于playfab自身的api和自编码组合完成，也可以剔除playfab api相关内容自己改成数据库连接(自己去改吧我懒得改了)。
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
