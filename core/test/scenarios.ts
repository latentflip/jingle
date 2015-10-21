import * as tape from 'tape';

import FakeNetwork from './FakeNetwork';
import StubApplication from './StubApplication';
import StubTransport from './StubTransport';

import {
    Ack,
    SessionRole,
    ContentSenders,
    ContentDirection,
    ReasonCondition,
    ContentState,
    SessionState,
    Disposition
} from '../src/definitions';
import Action from '../src/Action';
import SessionManager from '../src/SessionManager';

const test = tape.test;


function setupJingle() {
    let network = new FakeNetwork('me@example.com', 'peer@example.com');
    let jingle = new SessionManager();

    jingle.registerSignalLayer(network);
    jingle.registerApplicationType('stub', () => {
        return new StubApplication();
    });
    jingle.registerTransportType('stub', () => {
        return new StubTransport();
    });

    return { jingle, network };
}


export default function runTests() {
    test('[Scenario] Accept an incoming session', t => {
        t.plan(11);

        let { jingle, network } = setupJingle();

        jingle.onSession(async (session) => {
            t.ok(session, 'Session was created');
            t.equal(session.state, SessionState.Pending, 'Session is now pending');

            let content = await session.getContent(session.peerRole, 'test');
            t.ok(content, 'Content was created');
            t.equal(content.state, ContentState.Pending, 'Content is now pending');

            network.inspectNextRequest(request => {
                t.equal(request.action, Action.SessionAccept, 'Sent session-accept');
                t.equal(session.state, SessionState.Pending, 'Session is still pending');
                t.equal(content.state, ContentState.Pending, 'Content is still pending');
            });

            let ack = await session.accept();
            t.equal(ack, Ack.Ok, 'Session-accept acked');
            t.equal(session.state, SessionState.Active, 'Session is now active');
            t.equal(content.state, ContentState.Active, 'Content is now active');
            t.end();
        });

        network.receiveRequest(t, Ack.Ok, {
            sid: '1234',
            action: Action.SessionInitiate,
            contents: [
                {
                    creator: SessionRole.Initiator,
                    name: 'test',
                    application: {
                        applicationType: 'stub'
                    },
                    transport: {
                        transportType: 'stub'
                    }
                }
            ]
        });
    });

    test('[Scenario] Reject an incoming session', t => {
        t.plan(10);

        let { jingle, network } = setupJingle();

        jingle.onSession(async (session) => {
            t.ok(session, 'Session was created');
            t.equal(session.state, SessionState.Pending, 'Session is now pending');

            let content = await session.getContent(session.peerRole, 'test');
            t.ok(content, 'Content was created');
            t.equal(content.state, ContentState.Pending, 'Content is now pending');

            network.inspectNextRequest(request => {
                t.equal(request.action, Action.SessionTerminate, 'Sent session-terminate');
                t.equal(request.reason.condition, ReasonCondition.Decline, 'Formally declined session');
                t.equal(session.state, SessionState.Ended, 'Session is now ended');
                t.equal(content.state, ContentState.Removed, 'Content is now removed');
            });

            let ack = await session.end({ condition: ReasonCondition.Decline });
            t.equal(ack, Ack.Ok, 'Session-terminate acked');
            t.end();
        });

        network.receiveRequest(t, Ack.Ok, {
            action: Action.SessionInitiate,
            contents: [
                {
                    creator: SessionRole.Initiator,
                    name: 'test',
                    application: {
                        applicationType: 'stub'
                    },
                    transport: {
                        transportType: 'stub'
                    }
                }
            ]
        });
    });

    test('[Scenario] Offer a session', async (t) => {
        t.plan(5);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');
        t.end();
    });

    test('[Scenario] Cancel an offered session', async (t) => {
        t.plan(9);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionTerminate, 'Ended session');
            t.equal(request.reason.condition, ReasonCondition.Cancel, 'Formally cancelled session request');
        });
        await session.end({ condition: ReasonCondition.Cancel });
        t.equal(session.state, SessionState.Ended, 'Session is now ended');
        t.equal(content.state, ContentState.Removed, 'Content state is now removed');
        t.end();
    });

    test('[Scenario] Offer a session then add another content', async (t) => {
        t.plan(7);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        let content2 = session.createContent({
            name: 'test2',
            application: new StubApplication(),
            transport: new StubTransport()
        });

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.ContentAdd, 'Added content');
        });
        await content2.start();
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');
        t.end();
    });

    test('[Scenario] Receive a session, and then another content', async (t) => {
        t.plan(15);

        let { jingle, network } = setupJingle();


        jingle.onSession(async (session) => {
            t.ok(session, 'Session was created');
            t.equal(session.sid, '12345', 'Session has correct sid');
            t.equal(session.state, SessionState.Pending, 'Session is now pending');

            let content = await session.getContent(session.peerRole, 'test');
            t.ok(content, 'Content was created');
            t.equal(content.state, ContentState.Pending, 'Content is now pending');
        });

        await network.receiveRequest(t, Ack.Ok, {
            sid: '12345',
            action: Action.SessionInitiate,
            contents: [{
                creator: SessionRole.Initiator,
                name: 'test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        let session = jingle.getSession('peer@example.com', '12345');
        await session.wait();
        let content1 = await session.getContent(session.peerRole, 'test');

        await network.receiveRequest(t, Ack.Ok, {
            sid: '12345',
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Initiator,
                name: 'another-test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();

        let content2 = await session.getContent(session.peerRole, 'another-test');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionAccept, 'Sent session-accept');
            t.equal(session.state, SessionState.Pending, 'Session is still pending');
            t.equal(content1.state, ContentState.Pending, 'Content1 is still pending');
            t.equal(content2.state, ContentState.Pending, 'Content2 is still pending');
        });
        let ack = await session.accept();

        t.equal(ack, Ack.Ok, 'Session-accept acked');
        t.equal(session.state, SessionState.Active, 'Session is now active');
        t.equal(content1.state, ContentState.Active, 'Content1 is now active');
        t.equal(content2.state, ContentState.Active, 'Content2 is now active');
        t.end();
    });

    test('[Scenario] Offer a session, then receive another content', async (t) => {
        t.plan(7);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Responder,
                name: 'another-test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();
        let content2 = await session.getContent(session.peerRole, 'another-test');
        t.equal(content2.state, ContentState.Pending, 'Content2 is still pending');

        t.end();
    });

    test('[Scenario] Offer a session, then receive an early-session content', async (t) => {
        t.plan(7);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Responder,
                name: 'another-test',
                disposition: Disposition.EarlySession,
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();
        let content2 = await session.getContent(session.peerRole, 'another-test');
        t.equal(content2.state, ContentState.Pending, 'Content2 is still pending');

        t.end();
    });

    test('[Scenario] Locally remove the last content', async (t) => {
        t.plan(8);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.ContentRemove, 'Removed content');
            t.equal(session.state, SessionState.Pending, 'Session is still pending');
            t.equal(session.contents.get(session.role).size, 0, 'Session has no content');
        });
        await content.end({ condition: ReasonCondition.Success });

        t.end();
    });

    test('[Scenario] Remote side removes the last content', async (t) => {
        t.plan(9);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');


        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionTerminate, 'Ended session');
            t.equal(session.state, SessionState.Ended, 'Session is ended');
            t.equal(session.contents.get(session.role).size, 0, 'Session has no content');
        });

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentRemove,
            contents: [{
                creator: SessionRole.Initiator,
                name: 'test'
            }]
        });

        await session.wait();

        t.end();
    });

    test('[Scenario] Accept an offered content', async (t) => {
        t.plan(10);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Responder,
                name: 'another-test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();
        let content2 = await session.getContent(session.peerRole, 'another-test');
        t.equal(content2.state, ContentState.Pending, 'Content2 is pending');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.ContentAccept, 'Accepted content');
            t.equal(content2.state, ContentState.Pending, 'Content2 is pending until accept acked');
        });
        await content2.accept();
        await session.wait();

        t.equal(content2.state, ContentState.Active, 'Content2 state is now active');

        t.end();
    });

    test('[Scenario] Reject an offered content', async (t) => {
        t.plan(9);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Responder,
                name: 'another-test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();
        let content2 = await session.getContent(session.peerRole, 'another-test');
        t.equal(content2.state, ContentState.Pending, 'Content2 is pending');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.ContentReject, 'Rejected content');
            t.equal(content2.state, ContentState.Rejected, 'Content2 state is now rejected');
        });
        await content2.reject();
        await session.wait();

        t.end();
    });

    test('[Scenario] Change senders of an offered content', async (t) => {
        t.plan(10);

        let { jingle, network } = setupJingle();

        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'test',
            application: new StubApplication(),
            transport: new StubTransport()
        });
        await session.addContent(content);

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.SessionInitiate, 'Started session');
            t.equal(session.state, SessionState.Unacked, 'Session is now unacked');
            t.equal(content.state, ContentState.Unacked, 'Content state is now unacked');
        });
        await session.start();
        t.equal(session.state, SessionState.Pending, 'Session is now pending');
        t.equal(content.state, ContentState.Pending, 'Content state is now pending');

        await network.receiveRequest(t, Ack.Ok, {
            sid: session.sid,
            action: Action.ContentAdd,
            contents: [{
                creator: SessionRole.Responder,
                name: 'another-test',
                application: {
                    applicationType: 'stub'
                },
                transport: {
                    transportType: 'stub'
                }
            }]
        });

        await session.wait();
        let content2 = await session.getContent(session.peerRole, 'another-test');
        t.equal(content2.state, ContentState.Pending, 'Content2 is pending');
        t.equal(content2.direction, ContentDirection.SendRecv, 'Content2 is send/receive');

        network.inspectNextRequest(request => {
            t.equal(request.action, Action.ContentModify, 'Changed senders');
            t.equal(content2.direction, ContentDirection.Recv, 'Content2 is receive only');
        });
        await content2.modifySenders(ContentSenders.Responder);
        await session.wait();

        t.end();
    });
}
