import * as Jingle from 'jingle';

const FT4 = 'urn:xmpp:jingle:apps:file-transfer:4';

export interface File {
    name: string,
    size: number,
    mediaType: string
}

export interface FileDescription extends Jingle.ApplicationDescription {
    applicationType: string,
    file: File
}


export default class FileTransfer implements Jingle.Application {
    public applicationType: string = FT4;
    private fileDescription: File;
    private transport: Jingle.Transport;

    public equivalent(request: Jingle.RequestContent): boolean {
        return request.application.applicationType === this.applicationType;
    }

    public validateTransport(transport: Jingle.Transport): boolean {
        return true;
    }

    public setTransport(transport: Jingle.Transport): Promise<void> {
        this.transport = transport;
        return Promise.resolve();
    }

    public createOffer(): Promise<FileDescription> {
        return Promise.resolve({
            applicationType: FT4,
            file: this.fileDescription
        });
    }

    public createAnswer(): Promise<FileDescription> {
        return Promise.resolve({
            applicationType: FT4,
            file: this.fileDescription
        });
    }

    public applyOffer(offer: FileDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyAnswer(answer: FileDescription): Promise<void> {
        return Promise.resolve();
    }

    public applyInfo(info: FileDescription): Promise<void> {
        return Promise.resolve();
    }

    public changeDirection(direction: Jingle.ContentDirection): Promise<void> {
        return Promise.resolve();
    }

    public getStats(): Promise<void> {
        return Promise.resolve();
    }

    public end(): Promise<void> {
        return Promise.resolve();
    }
}
