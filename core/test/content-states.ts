import * as tape from 'tape';
import SessionManager from '../src/SessionManager';
import Session from '../src/Session';
import Action from '../src/Action';
import StubApplication from './StubApplication';
import StubTransport from './StubTransport';
import { Ack, SessionRole, SessionState, ContentState, ContentSenders } from '../src/definitions';

const test = tape.test;


let testState = async function(
    t: tape.Test,
    action: Action,
    sessionState: SessionState,
    contentState: ContentState,
    result: Ack,
    role?: SessionRole,
    sid?: string
) {
    let jingle = new SessionManager();
    let session = jingle.createSession('peer@example.com', 'me@example.com');
    let content = session.createContent({
        name: 'test',
        application: new StubApplication(),
        transport: new StubTransport()
    });
    await session.addContent(content);

    session.state = sessionState;
    content.state = contentState;

    jingle.processRequest({
        sid: sid || session.sid,
        action: action,
        contents: [{
            creator: role || session.role,
            name: 'test',
            application: { applicationType: 'stub' },
            transport: { transportType: 'stub' }
        }]
    }, 'peer@example.com', 'me@example.com').then(ack => {
        t.equal(Ack[ack], Ack[result], `${action.toString()} was processed by session in ` +
                                       `${SessionState[sessionState]} and content in ` +
                                       `${ContentState[contentState]} state`);
    }).catch(err => {
        t.equal(Ack[err], Ack[result], `${action.toString()} triggered ${Ack[result]} ` +
                                       `with session in ${SessionState[sessionState]} ` +
                                       `state and content in ${ContentState[contentState]} state`);
    });
};


export default function runTests() {
    test('[Content] Test content-accept with existing content', t => {
        t.plan(30);

        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentAccept, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentAccept, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAccept, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test content-add with existing content', t => {
        t.plan(30);

        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Unacked, Ack.TieBreak);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Pending, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Active, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Unacked, Ack.TieBreak);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Pending, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Active, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test content-add with new content', t => {
        t.plan(30);

        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Starting, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Pending, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Active, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Starting, ContentState.Removed, Ack.UnknownSession, SessionRole.Responder);

        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Active, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession, SessionRole.Responder);

        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Starting, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Unacked, Ack.TieBreak, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Pending, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Active, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Rejected, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Pending, ContentState.Removed, Ack.Ok, SessionRole.Responder);

        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Starting, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Unacked, Ack.TieBreak, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Pending, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Active, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Rejected, Ack.Ok, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Active, ContentState.Removed, Ack.Ok, SessionRole.Responder);

        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Starting, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Pending, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Active, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession, SessionRole.Responder);
        testState(t, Action.ContentAdd, SessionState.Ended, ContentState.Removed, Ack.UnknownSession, SessionRole.Responder);
    });

    test('[Content] Test content-remove with existing content', t => {
        t.plan(30);

        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Active, Ack.Ok);
        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentRemove, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Active, Ack.Ok);
        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentRemove, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentRemove, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test content-remove with existing content', t => {
        t.plan(30);

        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentReject, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentReject, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentReject, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentReject, SessionState.Active, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentReject, SessionState.Active, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.ContentReject, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentReject, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentReject, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test content-modify with existing content', t => {
        t.plan(30);

        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Active, Ack.Ok);
        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentModify, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentModify, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.ContentModify, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.ContentModify, SessionState.Active, ContentState.Pending, Ack.Ok);
        testState(t, Action.ContentModify, SessionState.Active, ContentState.Active, Ack.Ok);
        testState(t, Action.ContentModify, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.ContentModify, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.ContentModify, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test session-initiate with existing session', t => {
        t.plan(30);

        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Starting, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Unacked, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Active, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Rejected, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Removed, Ack.Ok);

        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Starting, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Unacked, Ack.TieBreak);
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Active, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Rejected, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Removed, Ack.Ok);

        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Starting, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Pending, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Rejected, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Removed, Ack.OutOfOrder);

        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Starting, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Pending, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Rejected, Ack.OutOfOrder);
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Removed, Ack.OutOfOrder);

        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Starting, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Unacked, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Active, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Rejected, Ack.Ok);
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Removed, Ack.Ok);
    });

    test('[Content] Test session-initiate with new session', t => {
        t.plan(30);

        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Starting, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Unacked, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Pending, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Active, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Rejected, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Starting, ContentState.Removed, Ack.Ok, null, 'z12345');

        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Starting, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Unacked, Ack.TieBreak, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Pending, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Active, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Rejected, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Unacked, ContentState.Removed, Ack.Ok, null, 'z12345');

        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Starting, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Unacked, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Pending, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Active, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Rejected, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Pending, ContentState.Removed, Ack.Ok, null, 'z12345');

        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Starting, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Unacked, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Pending, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Active, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Rejected, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Active, ContentState.Removed, Ack.Ok, null, 'z12345');

        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Starting, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Unacked, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Pending, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Active, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Rejected, Ack.Ok, null, 'z12345');
        testState(t, Action.SessionInitiate, SessionState.Ended, ContentState.Removed, Ack.Ok, null, 'z12345');
    });

    test('[Content] Test session-accept with existing content', t => {
        t.plan(30);

        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.SessionAccept, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Starting, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Pending, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Active, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Rejected, Ack.OutOfOrder);
        testState(t, Action.SessionAccept, SessionState.Active, ContentState.Removed, Ack.OutOfOrder);

        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionAccept, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });

    test('[Content] Test session-terminate with existing content', t => {
        t.plan(30);

        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Starting, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Unacked, ContentState.Removed, Ack.UnknownSession);

        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Active, Ack.Ok);
        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.SessionTerminate, SessionState.Pending, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Starting, Ack.BadRequest);
        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Unacked, Ack.OutOfOrder);
        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Pending, Ack.Ok);
        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Active, Ack.Ok);
        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Rejected, Ack.BadRequest);
        testState(t, Action.SessionTerminate, SessionState.Active, ContentState.Removed, Ack.BadRequest);

        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Starting, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Unacked, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Pending, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Active, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Rejected, Ack.UnknownSession);
        testState(t, Action.SessionTerminate, SessionState.Ended, ContentState.Removed, Ack.UnknownSession);
    });
}
