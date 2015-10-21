import { Transport, TransportDescription, Reason, ReasonCondition } from '../src/definitions';

type ResolveDescription = (desc: TransportDescription) => void;
type RejectReason = (reason: Reason) => void;


export default class StubTransport implements Transport {
    public transportType: string = 'stub';
    public inband: boolean = false;

    public getStats(): Promise<void> {
        return;
    }

    public createOffer(): Promise<TransportDescription> {
        return new Promise((resolve: ResolveDescription, reject: RejectReason) => {
            resolve({ transportType: this.transportType });
        });
    }

    public createAnswer(): Promise<TransportDescription> {
        return new Promise((resolve: ResolveDescription, reject: RejectReason) => {
            resolve({ transportType: this.transportType });
        });
    }

    public applyOffer(desc: TransportDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyAnswer(desc: TransportDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyInfo(desc: TransportDescription): Promise<void> {
        return;
    }

    public openStreamChannel(): Promise<void> {
        return;
    }

    public openDatagramChannel(): Promise<void> {
        return;
    }

    public end(): void {
        return;
    }
}
