/*************************** 老虎机 *********************************/
/**
 * 老虎机 常规矩阵玩法 获取结果
 * @param args.Type     老虎机类型
 * @param args.Rate     老虎机 压住倍数
 * @param args.LineNum  选择玩几条线
 *
 * 共享奖池的可以设置 服务器API登陆系统账号(例System_Slots)记录 "777"老虎机奖池状态是100W初始设置成状态值0或者其他 / 或者每人每玩X次同步到这个系统账号上降低修改次数频率 or 修改该玩家的统计数值(暂时没有看到统计数值请求限制)
 *
 * @returns {*}
 * @constructor
 */
handlers.GetSlotsResult = (args) => {
    if (!args.hasOwnProperty("Type")) {
        log.error("Param is error");
        return "Param is error";
    }

    if (!args.hasOwnProperty("Rate") || (args.hasOwnProperty("Rate") && args.Rate <= 0))
        args.Rate = 1;

    // TODO 为了早期让玩家玩老虎机 设置一次免费
    let GetUserReadOnlyDataResult = server.GetUserReadOnlyData({
        PlayFabId: currentPlayerId,
        Keys:[
            "UserStatus",
            "UserMissions",
            "UserPayment",
            "UserLastSlotsResult"
        ]
    });
    let UserStatus = JSON.parse(GetUserReadOnlyDataResult.Data.UserStatus.Value);
    let UserPayment = GetUserReadOnlyDataResult.Data.hasOwnProperty("UserPayment")?JSON.parse(GetUserReadOnlyDataResult.Data.UserPayment.Value):[];
    let UserLastSlotsResult = GetUserReadOnlyDataResult.Data.hasOwnProperty("UserLastSlotsResult")?JSON.parse(GetUserReadOnlyDataResult.Data.UserLastSlotsResult.Value):{};
    let SlotsFreeTime = UserStatus.hasOwnProperty("SlotsFree")?UserStatus.SlotsFree:0;
    if (SlotsFreeTime > 0 && args.Type === "Slots 777") {
        return new SlotsFree(args, UserStatus, UserLastSlotsResult);
    }
    // TODO 后期删除上面的部分
    let GetTitleDataResult = server.GetTitleData({
        Keys:[
            "SlotsSetting",
            "GoldenPig"
        ]
    });
    let SlotsSetting = JSON.parse(GetTitleDataResult.Data.SlotsSetting);
    let GoldenPig = JSON.parse(GetTitleDataResult.Data.GoldenPig);
    if (!Object.keys(SlotsSetting).includes(args.Type))
        return "Parameter error";
    args.LineNum = (!args.hasOwnProperty("LineNum") || args.LineNum < 1)?SlotsSetting[args.Type].WinLinesPosition.length:args.LineNum;
    let NeedGC = Math.floor((args.LineNum<SlotsSetting[args.Type].WinLinesPosition.length?args.LineNum:SlotsSetting[args.Type].WinLinesPosition.length)*SlotsSetting[args.Type].LineBet*args.Rate);
    let GetUserInventoryResult = server.GetUserInventory({ PlayFabId: currentPlayerId });
    if (NeedGC > (GetUserInventoryResult.VirtualCurrency.GC+GetUserInventoryResult.VirtualCurrency.CK*100000000)) {
        return "You don't have enough dollar";
    }
    let GetPlayerStatisticsResult = server.GetPlayerStatistics({PlayFabId: currentPlayerId, StatisticNames: [args.Type,"GOLDEN PIG"]});
    let UserJackpot = GetPlayerStatisticsResult.Statistics.length>0?GetPlayerStatisticsResult.Statistics[0]["Value"]:0;
    let UserGoldenPig = GetPlayerStatisticsResult.Statistics.length>1?GetPlayerStatisticsResult.Statistics[1]["Value"]:0;
    let Result = {
        Type: args.Type,
        LineIndex: [],
        Lines:[],
        WinLines: [],
        FullWinLines: [],
        WinLineBonus: [],
        Bonus : 0,
        Jackpot: {
            Bonus: 0,
            Statistic: {
                StatisticName: args.Type,
                Value:0
            }
        }
    };
    let Table = []; // 用户看到的图片 按轴 从上往下的顺序存储
    let Style = SlotsSetting[args.Type].Style;

    // 基本连线玩法
    if (UserLastSlotsResult === undefined || ((!UserLastSlotsResult.hasOwnProperty("FreeGame") || UserLastSlotsResult.FreeGame.FreeTime === 0)
        && (!UserLastSlotsResult.hasOwnProperty("BonusGame") || UserLastSlotsResult.BonusGame.FreeTime === 0))) {
        // 替换 需要替换的权重图片 轴随机停止的位置
        GetSlotsReplacePatterns(Result, SlotsSetting[args.Type], args)
        // 保存目标内容图片集合, 客户端屏幕显示的那部分图片集合
        for (let Index of Object.keys(Style)) {
            for (let i=0; i<Style[Index]; i++) {
                let ShowPattern = (Result.LineIndex[Index]+i >= Result.Lines[Index].length)?Result.Lines[Index][Result.LineIndex[Index]+i-Result.Lines[Index].length]:Result.Lines[Index][Result.LineIndex[Index]+i];
                Table.push(ShowPattern);
            }
        }
        // 计算中奖线
        CalculationSlotsPrizeLines(args, Result, SlotsSetting[args.Type], Table, SlotsSetting[args.Type].Universals)
    }

    if (SlotsSetting[args.Type].hasOwnProperty("BaseGame")) {
        new GetBaseGamePrize(Result, SlotsSetting[args.Type], NeedGC, Table);
    }

    if (SlotsSetting[args.Type].hasOwnProperty("FreeGame")) {
        new GetFreeGamePrize(args, Result, SlotsSetting[args.Type], Table, UserLastSlotsResult.FreeGame);
    }

    if (SlotsSetting[args.Type].hasOwnProperty("BonusGame")) {
        new GetBonusGamePrize(args, Result, SlotsSetting[args.Type], NeedGC, Table, UserLastSlotsResult.BonusGame);
    }

    if (SlotsSetting[args.Type].hasOwnProperty("Jackpot")) {
        GetJackPotPrize(args, Result, SlotsSetting[args.Type], NeedGC, Table, UserJackpot);
    }

    let Amount = Result.Bonus+Result.Jackpot.Bonus-NeedGC;
    if (Amount > 0) {
        if (Amount > 100000000) {
            let AddUserVirtualCurrencyRequest = {
                VirtualCurrency: "CK",
                Amount: Math.floor(Amount/100000000),
                PlayFabId: currentPlayerId
            }
            server.AddUserVirtualCurrency(AddUserVirtualCurrencyRequest);
        }
        let AddUserVirtualCurrencyRequest = {
            VirtualCurrency: "GC",
            Amount: Amount%100000000,
            PlayFabId: currentPlayerId
        }
        server.AddUserVirtualCurrency(AddUserVirtualCurrencyRequest);
    } else if (Amount < 0) {
        if (GetUserInventoryResult.VirtualCurrency.GC + Amount < 0) {
            let GCNUM = Math.ceil(Math.abs(GetUserInventoryResult.VirtualCurrency.GC + Amount)/100000000);
            let SubtractUserVirtualCurrencyRequest = {
                VirtualCurrency: "CK",
                Amount: GCNUM,
                PlayFabId: currentPlayerId
            }
            server.SubtractUserVirtualCurrency(SubtractUserVirtualCurrencyRequest);
            let AddUserVirtualCurrencyRequest = {
                VirtualCurrency: "GC",
                Amount: (GCNUM*100000000+Amount),
                PlayFabId: currentPlayerId
            }
            server.AddUserVirtualCurrency(AddUserVirtualCurrencyRequest);
        } else {
            let SubtractUserVirtualCurrencyRequest = {
                VirtualCurrency: "GC",
                Amount: Math.abs(Amount),
                PlayFabId: currentPlayerId
            }
            server.SubtractUserVirtualCurrency(SubtractUserVirtualCurrencyRequest);
        }
    }
    let UpdatePlayerStatistics = {
        PlayFabId: currentPlayerId,
        Statistics: [
            Result.Jackpot.Statistic
        ]
    }
    if (!UserPayment.includes("96002")) {
        let GoldenPigStatistics = {
            StatisticName: "GOLDEN PIG"
        };
        if (UserPayment.includes("96001")) {
            GoldenPigStatistics.Value = (UserGoldenPig+GoldenPig["96002"].Base)>=GoldenPig["96002"].Max?0:Math.round(eval("Bet="+NeedGC+";GPST="+(UserGoldenPig+GoldenPig["96002"].Base)+";"+GoldenPig["96002"].Formula));
        } else {
            GoldenPigStatistics.Value = (UserGoldenPig+GoldenPig["96001"].Base)>=GoldenPig["96001"].Max?0:Math.round(eval("Bet="+NeedGC+";GPST="+(UserGoldenPig+GoldenPig["96001"].Base)+";"+GoldenPig["96001"].Formula));
        }

        if (GoldenPigStatistics.Value !== 0) {
            Result.GoldenPig = GoldenPigStatistics.Value;
            UpdatePlayerStatistics.Statistics.push(GoldenPigStatistics);
        }
    }
    server.UpdatePlayerStatistics(UpdatePlayerStatistics);

    let UpdateUserReadOnlyDataRequest = {
        PlayFabId: currentPlayerId,
        Data: {
            UserLastSlotsResult: JSON.stringify(Result) // 保存结果 只保存一个结果 根据上传的Key防止丢失结果
        },
        Permission: "Private"
    }
    let Data = UpdateData({Index: "玩转老虎机15次", Value: 1}, MessageEnum.UPDATE_USER_MISSIONS_ACHIEVEMENTS_STATUS, GetUserReadOnlyDataResult.Data.UserMissions.Value);
    if (Data.UpdateData !== "{}") {
        UpdateUserReadOnlyDataRequest.Data.UserMissions = Data.UpdateData
        // 提示该玩家有完成的任务
        if (Data.hasOwnProperty("ReturnData")) {
            let accountInfo = server.GetUserAccountInfo({PlayFabId:currentPlayerId});
            let titlePlayerAccount = accountInfo.UserInfo.TitleInfo.TitlePlayerAccount;
            let entityEvent = {
                Entity: {
                    Id:titlePlayerAccount.Id,
                    Type:titlePlayerAccount.Type
                },
                EventNamespace: "custom.common",
                Name: "user_readonlydata_sync",
                PayloadJSON: JSON.stringify({UserMissions: Data.ReturnData})
            }
            entity.WriteEvents({Events:[entityEvent]});
        }
    }
    try {
        if (Object.keys(UpdateUserReadOnlyDataRequest.Data).length > 0)
            server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
    } catch (e) {
        log.error(e);
    }
    return Result;
}

/**
 * 替换整个轴中需要替换的图片
 * @param Result
 * @param SlotsSetting
 * @param args
 * @param Reels
 */
function GetSlotsReplacePatterns(Result, SlotsSetting, args, Reels) {
    let SlotsRandom = SlotsSetting.Random;
    for (let RandomPattern of Object.keys(SlotsRandom)) {
        let RandomData = {};
        RandomData = GetSlotsLastRandom(SlotsRandom[RandomPattern], RandomData);
        Reels = (Reels===undefined?SlotsSetting.Reels:Reels);
        Result.RandomIndex = RandomData.Index;
        for (let key of Object.keys(Reels)) {
            if (Result.LineIndex.length <= Reels.length)
                Result.LineIndex.push(Math.floor(Math.random()*Reels[key].length));
            Result.Lines[key] = [];
            for (let Pattern of Object.values(Reels[key])) {
                if (args.Type === "Slots 777") {
                    Result.Lines[key].push((key==="1"&&Pattern===RandomPattern)?(RandomData.Pattern+GetSlotsRandomRate(RandomData.Weights)):Pattern);
                } else {
                    Result.Lines[key].push(Pattern===RandomPattern?(RandomData.Pattern+GetSlotsRandomRate(RandomData.Weights)):Pattern);
                }
            }
        }
    }
}

/**
 * 通过最终的权重表 返回要替换的图片
 * @param Data
 * @returns {string}
 */
function GetSlotsRandomRate(Data) {
    let Pattern = "";
    let SumWeight = 0;
    for (let value of Object.values(Data)) {
        SumWeight += value.Weight;
    }
    let Random = parseInt(Math.random()*(SumWeight+1));
    let Start = 0;
    for (let value of Object.values(Data)) {
        if (Start <= Random && Random <= Start+value.Weight) {
            if (value.hasOwnProperty("Next")) {
                Pattern = value.Pattern+GetSlotsRandomRate(value.NextWeights);
            } else {
                Pattern = value.Pattern;
            }
            break;
        }
        Start += value.Weight;
    }
    return Pattern;
}

/**
 * 获取Random替换图片权重数据中 随机到的区间
 * @param SlotsRandom       基础权重表数据
 * @param ReturnRandom      目标权重表数据
 * @returns {*}
 */
function GetSlotsLastRandom(SlotsRandom, ReturnRandom) {
    let SumWeight = 0;
    for (let value of Object.values(SlotsRandom.Weights)) {
        SumWeight += value.Weight;
    }
    let Random = parseInt(Math.random()*(SumWeight+1));
    let Start = 0;
    if (SlotsRandom.Type === "ONCE")
        for (let value of Object.values(SlotsRandom.Weights)) {
            if (Start <= Random && Random <= Start+value.Weight) {
                // 其他玩法控制 替换图片权重的索引
                if (value.hasOwnProperty("Index"))
                    ReturnRandom.Index = value.Index;
                ReturnRandom.Pattern = (ReturnRandom.Pattern===undefined?"":ReturnRandom.Pattern)+value.Pattern;
                if (value.Next.Type === "ALL") {
                    ReturnRandom.Weights = value.Next.Weights;
                } else {
                    GetSlotsRandomRate(value.Next)
                }
                break;
            }
            Start += value.Weight;
        }
    else
        ReturnRandom = SlotsRandom;

    return ReturnRandom;
}

/**
 * JackPot 模块计算
 * @param args            客户端上传参数
 * @param Result          结果透传
 * @param SlotsSetting    老虎机基础模板数据
 * @param NeedGC          玩这次需要的金钱
 * @param Table           客户端转轴停下后显示的图片集合
 * @param UserJackpot     用户上次老虎机统计数据 Jackpot统计值
 */
function GetJackPotPrize(args, Result, SlotsSetting, NeedGC, Table, UserJackpot) {
    Result.Jackpot = {
        Bonus: 0,
        Statistic: {
            StatisticName: args.Type,
            Value:0
        }
    };
    Result.Jackpot.StatisticName = args.Type;
    // 保存目标内容图片集合,计算Jackpot概率
    let Win = true;
    for (let condition of Object.values(SlotsSetting.Jackpot.Condition)) {
        let Param = 0;
        for (let Index of Object.keys(Table)) {
            if (Table[Index].includes(condition.Pattern)) {
                Param += 1;
            }
        }
        if (Param === 0 || (Param > 0 && !eval("Param="+Param+";"+condition.Formula))) {
            Win = false;
            break;
        }
    }

    // 计算用户是否 中Jackpot
    if (Win) {
        Result.Jackpot.Bonus = SlotsSetting.Jackpot.Startup+UserJackpot;
        Result.Jackpot.Statistic.Value = 0;
    } else {
        Result.Jackpot.Statistic.Value = UserJackpot+Math.floor(NeedGC*SlotsSetting.Jackpot.Increment);
    }
}

/**
 * Basegame 模块计算
 * @param Result            结果透传
 * @param SlotsSetting      老虎机基础模板数据
 * @param NeedGC            玩这次需要的金钱
 * @param Table             客户端转轴停下后显示的图片集合
 */
function GetBaseGamePrize(Result, SlotsSetting, NeedGC, Table) {
    let BaseGame = {
        Position: [],
        Bonus: 0
    };
    let Win = true;
    for (let condition of Object.values(SlotsSetting.BaseGame.Condition)) {
        let Param = 0;
        for (let Index of Object.keys(Table)) {
            if (Table[Index].includes(condition.Pattern)) {
                Param += 1;
                BaseGame.Position.push(Index);
                let data = Table[Index].split("_");
                BaseGame.Bonus += NeedGC*(data.length>2?parseInt(data[2]):data[1]);
            }
        }
        if (Param === 0 || (Param > 0 && !eval("Param="+Param+";"+condition.Formula))) {
            Win = false;
            break;
        }
    }
    if (Win) {
        Result.Bonus += BaseGame.Bonus;
        delete BaseGame.Bonus;
        Result.BaseGame = BaseGame;
    }
}

/**
 * FreeGame 模块计算
 * @param args            客户端上传参数
 * @param Result          结果透传
 * @param SlotsSetting    老虎机基础模板数据
 * @param Table           客户端转轴停下后显示图片集合
 * @param UserFreeGame    上一次用户老虎机结果中的FreeGame数据
 */
function GetFreeGamePrize(args, Result, SlotsSetting, Table, UserFreeGame) {
    // 用户老虎机结果储存数据如果有FreeGame的话，说明是要参与FreeGame，没有这数据才是触发
    if (UserFreeGame === undefined) {
        let FreeGame = {
            PositionOld: [],
            PositionNew: [],
            FreeTime: SlotsSetting.FreeGame.FreeTime
        }
        let Win = true;
        for (let condition of Object.values(SlotsSetting.FreeGame.Condition)) {
            let Param = 0;
            for (let Index of Object.keys(Table)) {
                if (Table[Index].includes(condition.Pattern)) {
                    Param += 1;
                    FreeGame.PositionNew.push(Index);
                }
            }
            if (Param === 0 || (Param > 0 && !eval("Param="+Param+";"+condition.Formula))) {
                Win = false;
                break;
            }
        }
        if (Win) {
            Result.FreeGame = FreeGame;
        }
    } else {
        if (UserFreeGame.FreeTime > 0) {
            Table = [];
            Result.LineIndex = [];
            Result.Lines = SlotsSetting.FreeGame.Reels;
            // 随机位置
            for (let key of Object.keys(SlotsSetting.FreeGame.Reels)) {
                Result.LineIndex.push(Math.floor(Math.random()*SlotsSetting.FreeGame.Reels[key].length));
            }
            // 保存目标内容图片集合, 客户端屏幕显示的那部分图片集合
            for (let Index of Object.keys(SlotsSetting.FreeGame.Style)) {
                for (let i=0; i<SlotsSetting.FreeGame.Style[Index]; i++) {
                    let ShowPattern = (Result.LineIndex[Index]+i >= Result.Lines[Index].length)?Result.Lines[Index][Result.LineIndex[Index]+i-Result.Lines[Index].length]:Result.Lines[Index][Result.LineIndex[Index]+i];
                    Table.push(ShowPattern);
                    UserFreeGame.FreeTime += ShowPattern===SlotsSetting.FreeGame.Bonus.Pattern?1:0;
                }
            }
            // 计算SWILD的位置
            UserFreeGame.PositionOld = UserFreeGame.PositionNew;
            UserFreeGame.PositionNew = [];
            for (let i = 0; i < UserFreeGame.PositionOld.length; i++) {
                let Index = Math.floor(Math.random()*Table.length);
                while (UserFreeGame.PositionNew.indexOf(Index) !== -1 || SlotsSetting.FreeGame.Irreplaceable.includes(Table[Index])) {
                    Index = Math.floor(Math.random()*Table.length);
                }
                UserFreeGame.PositionNew.push(Index);
                Table[Index] = SlotsSetting.FreeGame.Universals;
            }
            UserFreeGame.FreeTime -= 1;
            Result.FreeGame = UserFreeGame;
            CalculationSlotsPrizeLines(args, Result, SlotsSetting, Table, SlotsSetting.FreeGame.Universals)
        }
    }
}

/**
 * BonusGame 模块计算
 * @param args              客户端上传参数
 * @param Result            结果透传
 * @param SlotsSetting      老虎机基础模板数据
 * @param NeedGC            玩一次需要的金钱
 * @param Table             客户端转轴停下后图片集合
 * @param UserBonusGame     上一次用户老虎机结果中 BonusGame数据
 */
function GetBonusGamePrize(args, Result, SlotsSetting, NeedGC, Table, UserBonusGame) {
    // 用户老虎机结果储存数据如果有BonusGame的话，说明是要参与BonusGame，没有这数据才是触发
    if (UserBonusGame === undefined) {
        let BonusGame = {
            Table: [],
            PositionOld: [],
            PositionNew: [],
            FreeTime: SlotsSetting.BonusGame.FreeTime,
            NeedGC: NeedGC,
            RandomIndex: Result.RandomIndex,
            Bonus: 0
        }
        let Win = true;
        for (let condition of Object.values(SlotsSetting.BonusGame.Condition)) {
            let Param = 0;
            for (let Index of Object.keys(Table)) {
                if (Table[Index].includes(condition.Pattern)) {
                    Param += 1;
                    BonusGame.PositionNew.push(Index);
                    let data = Table[Index].split("_");
                    BonusGame.Bonus += NeedGC*(data.length>2?parseInt(data[2]):data[1]);
                }
            }
            if (Param === 0 || (Param > 0 && !eval("Param="+Param+";"+condition.Formula))) {
                Win = false;
                break;
            }
        }
        if (Win) {
            let BonusGameLines = SlotsSetting.BonusGame.Map[Table.length - BonusGame.PositionNew.length - 1];
            shuffle(BonusGameLines)
            // 替换掉所有不是CHIP图标的位置  变成ReelX数据 方便找BonusGame.Reels数据
            let Index = 0;
            for (let Pattern of Object.values(Table)) {
                Pattern = Pattern.includes("CHIP")?Pattern:("Reel"+BonusGameLines[Index]);
                BonusGame.Table.push(Pattern);
                if (!Pattern.includes("CHIP"))
                    Index += 1;
            }
            Result.Bonus += BonusGame.Bonus;
            delete BonusGame.Bonus;
            Result.BonusGame = BonusGame;
        }
    } else {
        if (UserBonusGame.FreeTime > 0) {
            UserBonusGame.PositionOld = UserBonusGame.PositionOld.concat(UserBonusGame.PositionNew);
            UserBonusGame.PositionNew = [];
            Result.RandomIndex = UserBonusGame.RandomIndex;
            // 随机位置
            for (let Index of Object.keys(UserBonusGame.Table)) {
                if (UserBonusGame.Table[Index].includes("Reel") && eval(SlotsSetting.BonusGame.Reels[UserBonusGame.Table[Index]].Formula)) {
                    UserBonusGame.Table[Index] = SlotsSetting.BonusGame.Bonus.Pattern+"_"+GetSlotsRandomRate(SlotsSetting.BonusGame.Random[UserBonusGame.RandomIndex].Weights)
                    let data = UserBonusGame.Table[Index].split("_");
                    Result.Bonus += UserBonusGame.NeedGC*(data.length>2?parseInt(data[2]):data[1]);
                    UserBonusGame.PositionNew.push(Index);
                }
            }
            UserBonusGame.FreeTime -= 1;
            if (UserBonusGame.PositionNew.length > 0) {
                UserBonusGame.FreeTime = SlotsSetting.BonusGame.Bonus.Time;
                let BonusGameLines = SlotsSetting.BonusGame.Map[UserBonusGame.Table.length - UserBonusGame.PositionNew.length - UserBonusGame.PositionOld.length - 1];
                shuffle(BonusGameLines)
                // 替换掉所有不是CHIP图标的位置  变成ReelX数据 方便找BonusGame.Reels数据
                let Index = 0;
                let Table = [];
                for (let Pattern of Object.values(UserBonusGame.Table)) {
                    Pattern = Pattern.includes("CHIP")?Pattern:("Reel"+BonusGameLines[Index]);
                    Table.push(Pattern);
                    if (!Pattern.includes("CHIP"))
                        Index += 1;
                }
                UserBonusGame.Table = Table;
            }
            Result.BonusGame = UserBonusGame;
        }
    }
}

/**
 * 数组元素随机排序
 * @param arr
 */
function shuffle(arr) {
    let i = arr.length, t, j;
    while (i) {
        j = Math.floor(Math.random() * i--);
        t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
    }
}

/**
 * 老虎机 基础连线
 * @param args              客户端参数
 * @param Result            结果透传
 * @param SlotsSetting      老虎机数据基础模板
 * @param Table             客户端转轴停下后的显示图片集合
 * @param Universals        万能图片
 */
function CalculationSlotsPrizeLines(args, Result, SlotsSetting, Table, Universals) {
    // 基本连线玩法
    let num = 0;
    for (let Line of Object.values(SlotsSetting.WinLinesPosition)) {
        // 超出用户玩的线数就跳出，不再计算中奖线
        if (num >= args.LineNum)
            break;
        num += 1;
        let TargetLine = {
            Line: [],
            FullLine: [],
            Bonus: 0
        }
        for (let Num of Object.keys(SlotsSetting.PayTables)) {
            let WinPatterns = {};
            let PatternRate = 1;
            let CheckNum = parseInt(Num);
            // 初始化击中图标 集合
            for (let key of Object.keys(SlotsSetting.PayTables[Num])) {
                WinPatterns[key] = 0;
            }
            // 每条中奖线的单个图片序号(Table数据的序号)
            for (let i = 0; i < Line.length && i < CheckNum; i++) {
                let Index = Line[i];
                // for (let Index of Object.values(Line)) {
                let IndexPattern = Table[Index];
                // 如果有权重图片(有倍数的 拆分字符串)
                if (Table[Index].includes("_")) {
                    let data = Table[Index].split("_");
                    IndexPattern = data[0];
                    PatternRate = PatternRate * parseInt(data[1]);
                }
                // 快速排出不会中奖的图片
                if (SlotsSetting.NoWin.includes(IndexPattern))
                    break;
                // 枚举每个图片出现次数
                for (let key of Object.keys(WinPatterns)) {
                    if (key.includes(IndexPattern) || Universals.includes(IndexPattern))
                        WinPatterns[key] += 1;
                }
            }
            // 循环图片出现次数集合  计算大于客户端每个轴出现次数的图片 如果有那这条线就是中奖线 计算这条线的奖金
            for (let key of Object.keys(WinPatterns)) {
                if (WinPatterns[key] >= CheckNum) {
                    let Bonus = Math.floor(eval("WinLinesPositionLength=" + args.LineNum + ";Rate=" + args.Rate + ";" + SlotsSetting.PayTables[Num][key])*PatternRate);
                    if (Bonus > TargetLine.Bonus) {
                        TargetLine.Bonus = Bonus;
                        TargetLine.FullLine = Line;
                        TargetLine.Line = Line.slice(0, parseInt(Num));
                    }
                    break;
                }
            }
        }
        if (TargetLine.Bonus > 0 && TargetLine.Line.length > 0) {
            Result.Bonus += TargetLine.Bonus;
            let Index = Result.WinLineBonus.length;
            for (let i = 0; i < Result.WinLineBonus.length; i++) {
                if (TargetLine.Bonus >= Result.WinLineBonus[i]) {
                    Index = i;
                    break;
                }
            }
            Result.WinLineBonus.splice(Index, 0, TargetLine.Bonus);
            Result.FullWinLines.splice(Index, 0, TargetLine.FullLine);
            Result.WinLines.splice(Index, 0, TargetLine.Line);
        }
    }
    // log.debug(Table[0]+"      "+Table[3]+"      "+Table[6]+"      "+Table[9]+"      "+Table[12]);
    // log.debug(Table[1]+"      "+Table[4]+"      "+Table[7]+"      "+Table[10]+"      "+Table[13]);
    // log.debug(Table[2]+"      "+Table[5]+"      "+Table[8]+"      "+Table[11]+"      "+Table[14]);
}

/**
 *
 * @param args                    客户端上传参数
 * @param UserStatus              用户的每日免费次数
 * @param UserLastSlotsResult     上一次老虎机结果
 * @returns {*}
 */
function SlotsFree(args, UserStatus, UserLastSlotsResult) {
    UserStatus.SlotsFree -= 1;
    let GetTitleInternalDataRequest = {
        Keys:[
            "SlotsSetting",
            "SlotsFreeSetting"
        ]
    }
    let GetTitleInternalDataResult = server.GetTitleInternalData(GetTitleInternalDataRequest);
    let SlotsSetting = JSON.parse(GetTitleInternalDataResult.Data.SlotsSetting);
    let SlotsFreeSetting = JSON.parse(GetTitleInternalDataResult.Data.SlotsFreeSetting);
    if (!Object.keys(SlotsSetting).includes(args.Type))
        return "Parameter error";
    let Result = {
        Type: args.Type,
        LineIndex: [],
        Lines:[],
        WinLines: [],
        FullWinLines: [],
        WinLineBonus: [],
        Bonus : 0,
        Jackpot: {
            Bonus: 0,
            Statistic: {
                StatisticName: args.Type,
                Value:0
            }
        }
    };
    let Table = []; // 用户看到的图片 按轴 从上往下的顺序存储
    let Style = SlotsSetting[args.Type].Style;

    Result.LineIndex = SlotsFreeSetting[Math.floor(Math.random()*SlotsFreeSetting.length)];

    // 替换 需要替换的权重图片 轴随机停止的位置
    GetSlotsReplacePatterns(Result, SlotsSetting[args.Type], args)
    // 保存目标内容图片集合, 客户端屏幕显示的那部分图片集合
    for (let Index of Object.keys(Style)) {
        for (let i=0; i<Style[Index]; i++) {
            let ShowPattern = (Result.LineIndex[Index]+i >= Result.Lines[Index].length)?Result.Lines[Index][Result.LineIndex[Index]+i-Result.Lines[Index].length]:Result.Lines[Index][Result.LineIndex[Index]+i];
            Table.push(ShowPattern);
        }
    }
    // 计算中奖线
    CalculationSlotsPrizeLines(args, Result, SlotsSetting[args.Type], Table, SlotsSetting[args.Type].Universals)

    if (Result.Bonus+Result.Jackpot.Bonus > 0) {
        let AddUserVirtualCurrencyRequest = {
            VirtualCurrency: "GC",
            Amount: Math.abs(Result.Bonus+Result.Jackpot.Bonus),
            PlayFabId: currentPlayerId
        }
        server.AddUserVirtualCurrency(AddUserVirtualCurrencyRequest);
    }
    let UpdateUserReadOnlyDataRequest = {
        PlayFabId: currentPlayerId,
        Data: {
            UserStatus: JSON.stringify(UserStatus)
        },
        Permission: "Private"
    }
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);

    return Result;
}