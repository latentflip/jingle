import { Test } from 'tape';
import { SignalLayer, Request, Ack } from '../src/definitions';
import SessionManager from '../src/SessionManager';

export type RequestTester = (request: Request) => void;


export default class FakeNetwork implements SignalLayer {
    private sessionManager: SessionManager;
    private expectedRequests: RequestTester[];
    private queuedAcks: Ack[];
    private local: string;
    private remote: string;

    constructor(local: string, remote: string) {
        this.local = local;
        this.remote = remote;
        this.queuedAcks = [];
        this.expectedRequests = [];
    }

    public useSessionManager(manager: SessionManager) {
        this.sessionManager = manager;
    }

    public signal(to: string, from: string, request: Request): Promise<Ack> {
        let test = this.expectedRequests.shift();
        if (test) {
            test(request);
        }

        return new Promise<Ack>((resolve, reject) => {
            const ack = this.queuedAcks.shift() || Ack.Ok;

            if (ack === Ack.Ok) {
                resolve(ack);
            } else {
                reject(ack);
            }
        });
    }

    public inspectNextRequest(tester: RequestTester): void {
        this.expectedRequests.push(tester);
    }

    public injectAckForNextRequest(ack: Ack): void {
        this.queuedAcks.push(ack);
    }

    public receiveRequest(test: Test, expectedAck: Ack, request: Request): void {
        this.sessionManager.processRequest(request, this.remote, this.local).then(ack => {
            test.equal(ack, expectedAck, 'Received expected OK ack');
        }).catch(err => {
            test.equal(err, expectedAck, `Received expected ${Ack[expectedAck]} ack`);
        });
    }
}
