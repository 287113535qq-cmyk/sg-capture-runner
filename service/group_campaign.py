"""Opt-in per-group assignments; source requests remain on GitHub Runners."""
import json
from campaign import Campaign
from store import require, digest, file_lock

POLICY={'schema':'sg-independent-groups-v1','campaignId':'sg_round_one_20260928',
        'groups':['primary','secondary'],'startup':'available-workers','maxWorkersPerGroup':20}


class GroupCampaign(Campaign):
    independent_startup=True

    def __init__(self, root, runner_group, **kwargs):
        require(runner_group in POLICY['groups'],'RUNNER_GROUP_UNKNOWN')
        self.runner_group=runner_group
        super().__init__(root,_group_mode=True,**kwargs)
        try:
            require(json.loads((self.directory/'independent-groups.json').read_text())==POLICY,
                    'GROUP_POLICY_CHANGED')
            require(self._state() is not None,'GROUP_STATE_MISSING')
            require(self._state()['config_hash']==digest(self.config),'GROUP_CONFIG_CHANGED')
        except BaseException:
            self.close();raise

    def _state(self):
        return self.db.execute('SELECT * FROM group_control WHERE name=?',(self.runner_group,)).fetchone()

    def _update(self, fields, values=()):
        self.db.execute('UPDATE group_control SET '+fields+' WHERE name=?',(*values,self.runner_group))

    def _record_owner(self, gid):
        self.db.execute('INSERT INTO game_owners(game_id,group_name) VALUES(?,?)',(gid,self.runner_group))

    def allowed(self, new_round=False):
        global_state=self.db.execute('SELECT * FROM dispatch_control WHERE id=1').fetchone()
        if self.disk_free()<self.config['diskFinishReserveBytes']:
            self.pause_global('DISK_CRITICAL_RESERVE_REACHED');return False
        if new_round and self.disk_free()<self.config['diskReserveBytes']:
            self.pause_global('DISK_RESERVE_REACHED');return False
        if not global_state['enabled'] and not (not new_round and global_state['reason']=='DISK_RESERVE_REACHED'):
            return False
        return bool(self._state()['enabled'])

    def parking_enabled(self):
        from protocol_parking import enabled
        return enabled(self)

    def game_allowed(self, gid):
        return self._state()['active_game']==gid and self.allowed()

    def pause_game(self,gid,reason):
        # A late, fenced RPC from a parked game must not pause the next game.
        self.db.execute('UPDATE group_control SET enabled=0,reason=COALESCE(reason,?) WHERE name=? AND active_game=?',
                        (reason,self.runner_group,gid))

    def select(self, owner):
        require(isinstance(owner,str) and 1<=len(owner)<=100,'BAD_OWNER')
        if self.parking_enabled():
            with file_lock(self.directory/'selection.lock'):
                state=self._state()
                global_state=self.db.execute('SELECT enabled FROM dispatch_control').fetchone()
                if global_state[0] and state['active_game'] is not None and not state['enabled'] \
                        and state['reason']=='ACTIVE_GAME_REQUIRES_REVIEW':
                    from protocol_parking import park
                    try:
                        if not park(self):return {'action':'wait','waitingForGameDrain':True,
                                                  'gameId':state['active_game'],**self.status()}
                    except Exception as error:
                        reason='DISK_RESERVE_REACHED' if str(error)=='DISK_RESERVE_REACHED' else 'PARKING_REVIEW_REQUIRED'
                        self.pause_global(reason)
                        return {'action':'stop',**self.status()}
        return super().select(owner)

    def pause_global(self, reason):
        self.db.execute("UPDATE dispatch_control SET enabled=0,reason=CASE WHEN reason IS NULL OR reason='DISK_RESERVE_REACHED' THEN ? ELSE reason END WHERE id=1",(reason,))

    def pause(self, reason):
        if reason.startswith('DISK_'):
            self.pause_global(reason)
        else:
            super().pause(reason)

    def enable_by_operator(self):
        require(self.db.execute('SELECT enabled FROM dispatch_control WHERE id=1').fetchone()[0],
                'GLOBAL_REVIEW_REQUIRED')
        super().enable_by_operator()

    def assert_plan_access(self, game_id):
        row=self.db.execute('SELECT group_name FROM game_owners WHERE game_id=?',(game_id,)).fetchone()
        require(row is not None and row[0]==self.runner_group,'GROUP_GAME_MISMATCH')

    def status(self):
        state=super().status()
        global_state=dict(self.db.execute('SELECT * FROM dispatch_control WHERE id=1').fetchone())
        enabled=state['enabled'] and bool(global_state['enabled'])
        parking=self.parking_enabled()
        return {**state,'runnerGroup':self.runner_group,'startupPolicy':'available-workers',
                'protocolParkingEnabled':parking,'globalPaused':not bool(global_state['enabled']),
                'parkedGames':[r[0] for r in self.db.execute('SELECT game_id FROM parked_games ORDER BY game_id')] if parking else [],
                'enabled':enabled,'reason':global_state['reason'] or state['reason'],
                'status':'complete' if state['counts'].get('complete')==178 else 'running' if enabled else 'paused',
                'groups':[{k:r[k] for k in ('name','enabled','active_game','reason')}
                          for r in self.db.execute('SELECT * FROM group_control ORDER BY name')]}
