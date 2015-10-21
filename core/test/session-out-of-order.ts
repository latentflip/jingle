import * as tape from 'tape';
import Session from '../src/Session';
import Action from '../src/Action';
import { Ack, SessionRole, SessionState } from '../src/definitions';

const test = tape.test;


export default function runTests() {
    test('[Session] Out-of-Order: Initiator recieves session-initiate', t => {
        t.plan(5);

        function testState(state: SessionState) {
            let session = new Session(null, '12345', 'me@example.com', 'peer@example.com', SessionRole.Initiator);
            session.state = state;

            return session.processRequest({
                action: Action.SessionInitiate
            }).catch(err => {
                t.equal(err, Ack.OutOfOrder, `Out-of-order triggered in ${state} state`);
            });
        }

        testState(SessionState.Starting);
        testState(SessionState.Unacked);
        testState(SessionState.Pending);
        testState(SessionState.Active);
        testState(SessionState.Ended);
    });

    test('[Session] Out-of-Order: Initiator receives session-accept while not in pending state', t => {
        t.plan(4);

        function testState(state: SessionState) {
            let session = new Session(null, '12345', 'me@example.com', 'peer@example.com', SessionRole.Initiator);
            session.state = state;

            return session.processRequest({
                action: Action.SessionAccept,
                contents: [{ creator: SessionRole.Initiator, name: 'c' }]
            }).catch(err => {
                if (state !== SessionState.Pending) {
                    t.equal(err, Ack.OutOfOrder, `Out-of-order triggered in ${state} state`);
                }
            });
        }

        testState(SessionState.Starting);
        testState(SessionState.Unacked);
        testState(SessionState.Active);
        testState(SessionState.Ended);
    });

    test('[Session] Out-of-Order: Responder recieves session-accept', t => {
        t.plan(5);

        function testState(state: SessionState) {
            let session = new Session(null, '12345', 'peer@example.com', 'me@example.com', SessionRole.Responder);
            session.state = state;

            return session.processRequest({
                action: Action.SessionAccept
            }).catch(err => {
                t.equal(err, Ack.OutOfOrder, `Out-of-order triggered in ${state} state`);
            });
        }

        testState(SessionState.Starting);
        testState(SessionState.Unacked);
        testState(SessionState.Pending);
        testState(SessionState.Active);
        testState(SessionState.Ended);
    });

    test('[Session] Out-of-Order: Responder receives session-initiate while not in starting state', t => {
        t.plan(4);

        function testState(state: SessionState) {
            let session = new Session(null, '12345', 'peer@example.com', 'me@example.com', SessionRole.Responder);
            session.state = state;

            return session.processRequest({
                action: Action.SessionInitiate
            }).catch(err => {
                if (state !== SessionState.Starting) {
                    t.equal(err, Ack.OutOfOrder, `Out-of-order triggered in ${state} state`);
                }
            });
        }

        testState(SessionState.Unacked);
        testState(SessionState.Pending);
        testState(SessionState.Active);
        testState(SessionState.Ended);
    });
}
