import {
    ContentDirection,
    Application,
    ApplicationDescription,
    Reason,
    ReasonCondition,
    Transport,
    RequestContent
} from '../src/definitions';


type ResolveDescription = (desc: ApplicationDescription) => void;
type RejectReason = (reason: Reason) => void;


export default class StubApplication implements Application {
    public applicationType: string = 'stub';

    public equivalent(content: RequestContent): boolean {
        return true;
    }

    public validateTransport(transport: Transport): boolean {
        return true;
    }

    public setTransport(transport: Transport): Promise<void> {
        return Promise.resolve();
    }

    public changeDirection(direction: ContentDirection): Promise<void> {
        return Promise.resolve();
    }

    public createOffer(): Promise<ApplicationDescription> {
        return new Promise((resolve: ResolveDescription, reject: RejectReason) => {
            resolve({ applicationType: this.applicationType });
        });
    }

    public createAnswer(): Promise<ApplicationDescription> {
        return new Promise((resolve: ResolveDescription, reject: RejectReason) => {
            resolve({ applicationType: this.applicationType });
        });
    }

    public applyOffer(desc: ApplicationDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyAnswer(desc: ApplicationDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyInfo(desc: ApplicationDescription): Promise<void> {
        return;
    }

    public getStats(): Promise<void> {
        return;
    }

    public end(): void {
        return;
    }
}
