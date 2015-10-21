import * as tape from 'tape';
import SessionManager from '../src/SessionManager';
import Action from '../src/Action';
import StubApplication from './StubApplication';
import StubTransport from './StubTransport';
import { Ack, SessionRole, SessionState, ContentState, Request } from '../src/definitions';

const test = tape.test;


export default function runTests() {
    test('[SessionManager] Create incoming session', async(t) => {
        t.plan(2);

        let jingle = new SessionManager();
        let result = await jingle.processRequest({
            sid: '12345',
            action: Action.SessionInitiate,
            initiator: 'peer@example.com',
            contents: [{
                creator: SessionRole.Initiator,
                name: 'c',
                application: { applicationType: 'stub' },
                transport: { transportType: 'stub' }
            }]
        }, 'peer@example.com', 'me@example.com');

        t.equal(result, Ack.Ok, 'Session initiate acked');

        let session = jingle.getSession('peer@example.com', '12345');
        t.ok(session, 'Session exists');
    });

    test('[SessionManager] Unknown session', async(t) => {
        t.plan(2);

        let jingle = new SessionManager();

        try {
            await jingle.processRequest({
                sid: '12345',
                action: Action.ContentAdd,
                initiator: 'peer@example.com',
                contents: [{
                    creator: SessionRole.Initiator,
                    name: 'c',
                    application: { applicationType: 'stub' },
                    transport: { transportType: 'stub' }
                }]
            }, 'peer@example.com', 'me@example.com');
        } catch (err) {
            t.equal(err, Ack.UnknownSession, 'Session not found');

            let session = jingle.getSession('peer@example.com', '12345');
            t.notOk(session, 'Session was not created');
        }
    });

    test('[SessionManager] Tie-break: Win with low sid', async(t) => {
        t.plan(2);

        let jingle = new SessionManager();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        session.state = SessionState.Unacked;
        session.addContent(session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        }));

        let content = await session.getContent(session.role, 'local');
        content.state = ContentState.Unacked;

        try {
            await jingle.processRequest({
                sid: session.sid + 'z',
                action: Action.SessionInitiate,
                initiator: 'peer@example.com',
                contents: [{
                    creator: SessionRole.Initiator,
                    name: 'c',
                    application: { applicationType: 'stub' },
                    transport: { transportType: 'stub' }
                }]
            }, 'peer@example.com', 'me@example.com');
        } catch (err) {
            t.equal(err, Ack.TieBreak, 'Won tie break');

            let newSession = jingle.getSession('peer@example.com', session.sid + 'Z');
            t.notOk(newSession, 'Session was not created');
        }
    });

    test('[SessionManager] Tie-break: Lose with high sid', async(t) => {
        t.plan(2);

        let jingle = new SessionManager();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        session.state = SessionState.Unacked;
        session.addContent(session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        }));

        let content = await session.getContent(session.role, 'local');
        content.state = ContentState.Unacked;

        let result = await jingle.processRequest({
            sid: session.sid.substr(0, 5),
            action: Action.SessionInitiate,
            initiator: 'peer@example.com',
            contents: [{
                creator: SessionRole.Initiator,
                name: 'c',
                application: { applicationType: 'stub' },
                transport: { transportType: 'stub' }
            }]
        }, 'peer@example.com', 'me@example.com');

        t.equal(result, Ack.Ok, 'Lost tie break');

        let newSession = jingle.getSession('peer@example.com', session.sid.substr(0, 5));
        t.ok(newSession, 'Session was created');
    });

    test('[SessionManager] Tie-break: Win with low user ID', async(t) => {
        t.plan(1);

        let jingle = new SessionManager();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        session.state = SessionState.Unacked;
        session.addContent(session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        }));

        let content = await session.getContent(session.role, 'local');
        content.state = ContentState.Unacked;

        try {
            await jingle.processRequest({
                sid: session.sid,
                action: Action.SessionInitiate,
                initiator: 'peer@example.com',
                contents: [{
                    creator: SessionRole.Initiator,
                    name: 'c',
                    application: { applicationType: 'stub' },
                    transport: { transportType: 'stub' }
                }]
            }, 'peer@example.com', 'me@example.com');
        } catch (err) {
            t.equal(err, Ack.TieBreak, 'Won tie break');
        }
    });

    test('[SessionManager] Tie-break: Lose with high user ID', async(t) => {
        t.plan(1);

        let jingle = new SessionManager();
        let session = jingle.createSession('peer@example.com', 'zme@example.com');
        session.state = SessionState.Unacked;
        session.addContent(session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        }));


        let content = await session.getContent(session.role, 'local');
        content.state = ContentState.Unacked;

        let result = await jingle.processRequest({
            sid: session.sid,
            action: Action.SessionInitiate,
            initiator: 'peer@example.com',
            contents: [{
                creator: SessionRole.Initiator,
                name: 'c',
                application: { applicationType: 'stub' },
                transport: { transportType: 'stub' }
            }]
        }, 'peer@example.com', 'zme@example.com');

        t.equal(result, Ack.Ok, 'Lost tie break');
    });

    test('[SessionManager] Bad request', async(t) => {
        t.plan(1);

        let jingle = new SessionManager();
        let session = jingle.createSession('me@example.com', 'me@example.com');
        session.state = SessionState.Unacked;
        session.addContent(session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        }));


        let content = await session.getContent(session.role, 'local');
        content.state = ContentState.Unacked;

        try {
            await jingle.processRequest({
                sid: session.sid,
                action: Action.SessionInitiate,
                initiator: 'me@example.com',
                contents: [{
                    creator: SessionRole.Initiator,
                    name: 'c',
                    application: new StubApplication(),
                    transport: new StubTransport()
                }]
            }, 'me@example.com', 'me@example.com');
        } catch (err) {
            t.equal(err, Ack.BadRequest, 'Bad request');
        }
    });
}
