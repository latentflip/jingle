import * as tape from 'tape';
import SessionManager from '../src/SessionManager';
import Session from '../src/Session';
import Action from '../src/Action';
import Content from '../src/Content';
import StubApplication from './StubApplication';
import StubTransport from './StubTransport';
import { Ack, SessionRole, SessionState, ContentState } from '../src/definitions';

const test = tape.test;
const appStub = new StubApplication();
const tranStub = new StubTransport();


function setupJingle() {
    let jingle = new SessionManager();
    jingle.registerApplicationType('stub', () => {
        return new StubApplication();
    });
    jingle.registerTransportType('stub', () => {
        return new StubTransport();
    });
    return jingle;
}


export default function runTests() {

    test('[Local Action] Add content', t => {
        t.plan(3);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({
            name: 'local',
            application: new StubApplication(),
            transport: new StubTransport()
        });

        session.addContent(content).then(ack => {
            t.equal(ack, Ack.Ok, 'Content add action was processed');
            session.getContent(SessionRole.Initiator, 'local').then(content => {
                t.ok(content, 'Content object exists');
                t.equal(content.state, ContentState.Starting, 'Content in starting state');
            });
        });
    });

    test('[Local Action] Add multiple contents', t => {
        t.plan(7);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });
        let c2 = session.createContent({ name: 'local-2', application: appStub, transport: tranStub });
        let c3 = session.createContent({ name: 'local-3', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(c1),
            session.addContent(c2),
            session.addContent(c3)
        ]).then(results => {
            t.equal(results[0], Ack.Ok, 'First content action was processed');
            t.equal(results[1], Ack.Ok, 'Second content action was processed');
            t.equal(results[2], Ack.Ok, 'Third content action was processed');

            session.getStats().then(stats => {
                t.equal(stats.contents.length, 3, 'All content exist');
                stats.contents.forEach(content => {
                    t.equal(content.state, ContentState.Starting, `Content ${content.name} in starting state`);
                });
            });
        });
    });

    test('[Local Action] Start session', t => {
        t.plan(2);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });
        let c2 = session.createContent({ name: 'local-2', application: appStub, transport: tranStub });
        let c3 = session.createContent({ name: 'local-3', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(c1),
            session.addContent(c2),
            session.addContent(c3)
        ]).then(() => {
            return session.start();
        }).then(result => {
            t.equal(result, Ack.Ok, 'Session initiate processed');
            t.equal(session.state, SessionState.Pending, 'Session in pending state');
        });
    });

    test('[Local Action] Start session and then add more content', t => {
        t.plan(6);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });
        let c2 = session.createContent({ name: 'local-2', application: appStub, transport: tranStub });
        let c3 = session.createContent({ name: 'local-3', application: appStub, transport: tranStub });
        let c4 = session.createContent({ name: 'after-start-1', application: appStub, transport: tranStub });
        let c5 = session.createContent({ name: 'after-start-2', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(c1),
            session.addContent(c2),
            session.addContent(c3),
            session.start(),
            session.addContent(c4),
            session.addContent(c5)
        ]).then(result => {
            return session.getStats();
        }).then(stats => {
            t.equal(stats.state, SessionState.Pending, 'Session in pending state');
            stats.contents.forEach(content => {
                t.equal(content.state, ContentState.Pending, `Content ${content.name} in pending state`);
            });
        });
    });

    test('[Local Action] Add and remove content', t => {
        t.plan(3);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });

        session.addContent(c1).then(res => {
            return session.getContent(session.role, 'local-1');
        }).then((content) => {
            t.ok(content, 'Content was added');
            t.equal(content.state, ContentState.Starting, 'Content in starting state');
            return session.removeContent({ creator: session.role, name: 'local-1' });
        }).then((res) => {
            return session.getContent(session.role, 'local-1');
        }).catch(content => {
            t.notOk(content, 'Content was removed');
        });
    });

    test('[Local Action] Start session after removing content', t => {
        t.plan(3);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });
        let c2 = session.createContent({ name: 'local-2', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(c1),
            session.addContent(c2),
            session.removeContent({ creator: session.role, name: 'local-1' }),
            session.start()
        ]).then(result => {
            t.equal(session.state, SessionState.Pending, 'Session in pending state');

            session.getContent(session.role, 'local-1').catch(res => {
                t.notOk(res, 'Content local-1 was removed');
            });

            session.getContent(session.role, 'local-2').then(res => {
                t.ok(res, 'Content local-2 was added');
            });
        });
    });


    test('[Local Action] Remove content after session start', t => {
        t.plan(3);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        let c1 = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });
        let c2 = session.createContent({ name: 'local-2', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(c1),
            session.addContent(c2),
            session.start()
        ]).then(() => {
            return session.removeContent({ creator: session.role, name: 'local-1' });
        }).then(() => {
            t.equal(session.state, SessionState.Pending, 'Session in pending state');

            session.getContent(session.role, 'local-1').catch(res => {
                t.notOk(res, 'Content local-1 was removed');
            });

            session.getContent(session.role, 'local-2').then(res => {
                t.ok(res, 'Content local-2 was added');
            });
        });
    });

    test('[Local Action] Session start with no content', t => {
        t.plan(1);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        session.start().catch(err => {
            t.equal(err, Ack.BadRequest, 'Can not start session with no content');
        });
    });

    test('[Local Action] Session terminate without starting', t => {
        t.plan(2);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');

        session.end().then(ack => {
            t.equal(ack, Ack.Ok, 'Terminate successful');
            t.equal(session.state, SessionState.Ended, 'Session in ended state');
        });
    });

    test('[Local Action] Session terminate with content, without starting', t => {
        t.plan(2);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });

        session.addContent(content);
        session.end().then(ack => {
            t.equal(ack, Ack.Ok, 'Terminate successful');
            t.equal(session.state, SessionState.Ended, 'Session in ended state');
        });
    });

    test('[Local Action] Session terminate with content, after starting', t => {
        t.plan(2);

        let jingle = setupJingle();
        let session = jingle.createSession('peer@example.com', 'me@example.com');
        let content = session.createContent({ name: 'local-1', application: appStub, transport: tranStub });

        Promise.all([
            session.addContent(content),
            session.start()
        ]).then(() => {
            session.end().then(ack => {
                t.equal(ack, Ack.Ok, 'Terminate successful');
                t.equal(session.state, SessionState.Ended, 'Session in ended state');
            });
        });
    });

    test('[Local Action] Accept session', t => {
        t.plan(2);

        let jingle = setupJingle();

        jingle.processRequest({
            sid: '12345',
            action: Action.SessionInitiate,
            contents: [{
                creator: SessionRole.Initiator,
                name: 'remote-content',
                application: { applicationType: 'stub' },
                transport: { transportType: 'stub' }
            }]
        }, 'peer@example.com', 'me@example.com').then(() => {
            let session = jingle.getSession('peer@example.com', '12345');

            session.accept().then(ack => {
                t.equal(ack, Ack.Ok, 'Accept successful');
                t.equal(session.state, SessionState.Active, 'Session in active state');
            });
        });
    });
}
