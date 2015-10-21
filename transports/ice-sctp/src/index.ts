import * as Jingle from 'jingle';

const NS = 'http://lance.im/p/jingle-ice-sctp';


export interface SctpIceCandidate {

}

export interface SctpDescription extends Jingle.TransportDescription {
    transportType: string;
    usernameFragment: string;
    password: string;
    candidates?: [SctpIceCandidate];
}


export default class SctpTransport implements Jingle.Transport {
    public transportType: string = NS;
    public inband: boolean = false;
    public connection: RTCPeerConnection;


    constructor() {
        this.connection = new RTCPeerConnection();
    }

    public async createOffer(): Promise<SctpDescription> {
        const desc = await this.connection.createOffer();
        await this.connection.setLocalDescription(desc);

        return {
            transportType: NS,
            usernameFragment: '',
            password: ''
        };
    }

    public async createAnswer(): Promise<SctpDescription> {
        const desc = await this.connection.createAnswer();
        await this.connection.setLocalDescription(desc);

        return {
            transportType: NS,
            usernameFragment: '',
            password: ''
        };
    }

    public applyOffer(offer: SctpDescription): Promise<void> {
        return this.connection.setRemoteDescription({
            type: 'offer',
            sdp: ''
        });
    }

    public applyAnswer(answer: SctpDescription): Promise<void> {
        return this.connection.setRemoteDescription({
            type: 'answer',
            sdp: ''
        });
    }

    public applyInfo(info: SctpDescription): Promise<void> {
        if (info.candidates) {
            info.candidates.forEach(candidate => {
                this.connection.addIceCandidate({
                    candidate: '',
                    sdpMid: 'data',
                    sdpMLineIndex: 0
                });
            });
        }
        return Promise.resolve();
    }

    public getStats(): Promise<void> {
        return Promise.resolve();
    }

    public openStreamChannel(): Promise<void> {
        const channel = this.connection.createDataChannel(null, {
            ordered: true,
            negotiated: true
        });
        return Promise.resolve();
    }

    public openDatagramChannel(): Promise<void> {
        const channel = this.connection.createDataChannel(null, {
            ordered: false,
            negotiated: true
        });
        return Promise.resolve();
    }

    public end(): Promise<void> {
        return Promise.resolve();
    }
}
