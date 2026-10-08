import test from 'node:test';
import assert from 'node:assert/strict';
import {RoxorCometDSession} from '../src/ag.client';
import {captureAGRound} from '../src/ag.round';

test('Christmas Cottage 小写协议保留官方 PickRequest 参数', () => {
    const session = new RoxorCometDSession({gameId:'play-christmas-cottage',name:'Christmas Cottage',backendArtifactId:'rgp-game-christmas-cottage'});
    (session as any).protocol = 'lowercase-standard';
    assert.deepEqual(session.getPickParams('0'), {roundIndex:'0',pickIndex:'0',autoPick:'false'});
    assert.deepEqual(session.getPickParams('2'), {roundIndex:'0',pickIndex:'2',autoPick:'false'});
    assert.equal(session.getPickEvent(), 'PickRequest');
    const other = new RoxorCometDSession({gameId:'other',name:'other'});
    (other as any).protocol = 'lowercase-standard';
    assert.deepEqual(other.getPickParams('2'), {pickIndex:'2'});
});

test('Christmas Cottage 使用官方十五选一协议', () => {
    const session = new RoxorCometDSession({gameId:'play-christmas-cottage',name:'Christmas Cottage',backendArtifactId:'rgp-game-christmas-cottage'});
    const protocol = session.getPickProtocol('PICK', {});

    assert.equal(protocol?.event, 'PickRequest');
    assert.equal(protocol?.kind, 'choice');
    assert.deepEqual(protocol?.options, Array.from({length:15}, (_, index) => ({
        pickIndex:index + 1,
        requestPickIndex:index,
    })));

    const continued = session.getPickProtocol('PICK', {}, [0, 4]);
    assert.deepEqual(continued?.revealedIndexes, [0, 4]);
    assert.deepEqual(continued?.options.map(option => option.requestPickIndex), [1,2,3,5,6,7,8,9,10,11,12,13,14]);
});

test('Christmas Cottage 连续五次选择不会重复请求同一格', async () => {
    const session = new RoxorCometDSession({gameId:'play-christmas-cottage',name:'Christmas Cottage',backendArtifactId:'rgp-game-christmas-cottage'});
    const selected:number[]=[];
    (session as any).callGameData = async (event:string, parameters:Record<string,any>) => {
        if (event === 'Spin') return {NextActionInfo:{nextAction:'PICK'},PlayerBalanceInfo:{wager:0.2}};
        const index=Number(parameters.pickIndex);
        assert.equal(selected.includes(index),false);
        selected.push(index);
        return {NextActionInfo:{nextAction:selected.length===5?'SPIN':'PICK'},PlayerBalanceInfo:{resultAmount:1,balance:100.8}};
    };
    const round=await captureAGRound(session,{chooseOption:options=>options[0]});
    assert.deepEqual(selected,[0,1,2,3,4]);
    assert.equal(round.optionCount,15);
    assert.equal(round.optionIndex,1);
    assert.equal(round.data.freeChoiceSteps.length,5);
});

test('Christmas PickRequest 不被小写协商改写', async () => {
    const session = new RoxorCometDSession({gameId:'play-christmas-cottage',name:'Christmas Cottage',backendArtifactId:'rgp-game-christmas-cottage'});
    (session as any).protocol = 'lowercase-standard';
    const calls: any[] = [];
    (session as any).callGameRaw = async (event: string, parameters: any) => {
        calls.push({event, parameters});
        return {data: {responseText: JSON.stringify({NextActionInfo:{nextAction:'FREE_SPIN'}})}};
    };
    await session.callGameData(session.getPickEvent(), session.getPickParams('4'));
    assert.deepEqual(calls, [{event:'PickRequest',parameters:{roundIndex:'0',pickIndex:'4',autoPick:'false'}}]);
});
