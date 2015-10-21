import {
    SessionRole,
    SessionState,
    ContentSenders,
    ContentState,
    ContentOptions,
    Disposition,
    RequestContent,
    Ack,
    Reason,
    Application,
    Transport,
    ReasonCondition,
    ContentDirection,
    ApplicationDescription,
    TransportDescription
} from './definitions';
import Action from './Action';
import Session from './Session';


const VALID_ACTIONS = {
    [ContentState.Starting]: {
        [Action.ContentAdd.value]: Ack.Ok
    },
    [ContentState.Unacked]: {
        [Action.ContentAdd.value]: Ack.OutOfOrder,
        [Action.ContentAccept.value]: Ack.OutOfOrder,
        [Action.ContentReject.value]: Ack.OutOfOrder,
        [Action.ContentRemove.value]: Ack.OutOfOrder,
        [Action.ContentModify.value]: Ack.OutOfOrder
    },
    [ContentState.Pending]: {
        [Action.ContentAdd.value]: Ack.OutOfOrder,
        [Action.ContentAccept.value]: Ack.Ok,
        [Action.ContentReject.value]: Ack.Ok,
        [Action.ContentRemove.value]: Ack.Ok,
        [Action.ContentModify.value]: Ack.Ok
    },
    [ContentState.Active]: {
        [Action.ContentAdd.value]: Ack.OutOfOrder,
        [Action.ContentAccept.value]: Ack.OutOfOrder,
        [Action.ContentReject.value]: Ack.OutOfOrder,
        [Action.ContentRemove.value]: Ack.Ok,
        [Action.ContentModify.value]: Ack.Ok
    },
    [ContentState.Rejected]: {},
    [ContentState.Removed]: {}
};


function sendersToDirection(role: SessionRole, senders: ContentSenders) {
    const isInitiator = role === SessionRole.Initiator;

    switch (senders) {
        case ContentSenders.Initiator:
            return (isInitiator) ? ContentDirection.Recv : ContentDirection.Send;
        case ContentSenders.Responder:
            return (isInitiator) ? ContentDirection.Recv : ContentDirection.Send;
        case ContentSenders.Both:
            return ContentDirection.SendRecv;
        case ContentSenders.None:
            return ContentDirection.None;
    }
}


export default class Content {

    public creator: SessionRole;
    public name: string;
    public disposition: string;
    public senders: ContentSenders;
    public state: ContentState;
    public session: Session;
    public application: Application;
    public transport: Transport;
    public replacementTransport: Transport;

    private unackedSendersChange: ContentSenders;
    private performTieBreaks: boolean;


    constructor(session: Session, opts: ContentOptions) {
        this.creator = opts.creator;
        this.name = opts.name;
        this.senders = opts.senders || ContentSenders.Both;
        this.disposition = opts.disposition || Disposition.Session;

        this.application = opts.application;
        this.transport = opts.transport;

        this.state = ContentState.Starting;
        this.session = session;

        this.unackedSendersChange = null;
        this.performTieBreaks = session.role === SessionRole.Initiator;
    }

    public get direction(): ContentDirection {
        return sendersToDirection(this.session.role, this.senders);
    }

    public isLive(): boolean {
        return this.state === ContentState.Unacked ||
               this.state === ContentState.Pending ||
               this.state === ContentState.Active;
    }

    public start(): Promise<Ack> {
        return this.session.addContent(this);
    }

    public accept(): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.ContentAccept,
            contents: [this]
        });
    }

    public reject(reason?: Reason): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.ContentReject,
            contents: [this],
            reason: reason
        });
    }

    public end(reason?: Reason): Promise<Ack> {
        return this.session.removeContent(this, reason);
    }

    public modifySenders(senders: ContentSenders): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.ContentModify,
            contents: [{
                creator: this.creator,
                name: this.name,
                senders: senders
            }]
        });
    }

    public replaceTransport(transport: Transport): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.TransportReplace,
            contents: [{
                creator: this.creator,
                name: this.name,
                transport: transport
            }]
        });
    }

    public acceptTransport(): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.TransportAccept,
            contents: [ this ]
        });
    }

    public rejectTransport(): Promise<Ack> {
        return this.session.processLocalRequest({
            action: Action.TransportReject,
            contents: [ this ]
        });
    }

    public equivalent(requests: RequestContent[]): boolean {
        for (let i = 0; i < requests.length; i++) {
            if (this.application.equivalent(requests[i])) {
                return true;
            }
        }
        return false;
    }

    public validateRemoteRequest(action: Action, request: RequestContent): Ack {
        let ack = VALID_ACTIONS[this.state][action.value];

        if (ack === undefined) {
            return Ack.BadRequest;
        } else if (ack !== Ack.Ok) {
            return ack;
        }

        switch (action) {
            case Action.ContentAdd:
                if (request.creator !== this.session.peerRole) {
                    return Ack.BadRequest;
                }
                if (!request.application) {
                    return Ack.BadRequest;
                }
                break;

            case Action.ContentModify:
                if (this.performTieBreaks && this.unackedSendersChange && request.senders !== this.unackedSendersChange) {
                    return Ack.TieBreak;
                }
                break;

            case Action.TransportReplace:
                if (this.performTieBreaks && this.replacementTransport) {
                    return Ack.TieBreak;
                }
        }

        return ack;
    }

    public validateLocalRequest(action: Action, request: RequestContent): Ack {
        let ack = VALID_ACTIONS[this.state][action.value];

        if (ack === undefined) {
            if (action === Action.ContentRemove && this.state === ContentState.Starting) {
                return Ack.Ok;
            }
            return Ack.BadRequest;
        } else if (ack !== Ack.Ok) {
            return ack;
        }

        switch (action) {
            case Action.ContentAdd:
                if (request.creator !== this.session.role) {
                    return Ack.BadRequest;
                }
                if (!request.application) {
                    return Ack.BadRequest;
                }
                break;

            case Action.ContentAccept:
                if (this.creator === this.session.role) {
                    return Ack.OutOfOrder;
                }
                break;

            case Action.ContentReject:
                if (this.creator === this.session.role) {
                    return Ack.OutOfOrder;
                }
                break;

            case Action.TransportReplace:
                if (!this.application.validateTransport(<Transport>request.transport)) {
                    return Ack.BadRequest;
                }
                if (this.replacementTransport && !this.performTieBreaks) {
                    return Ack.TieBreak;
                }
                break;
        }

        return Ack.Ok;
    }

    public executeRemoteRequest(action: Action, request?: RequestContent): Promise<void> {
        switch (action) {
            case Action.ContentAdd:
                return this._executeRemoteContentAdd(action, request);
            case Action.ContentAccept:
                return this._executeRemoteContentAccept(action, request);
            case Action.ContentReject:
                return this._executeRemoteContentReject(action, request);
            case Action.ContentRemove:
                return this._executeRemoteContentRemove(action, request);
            case Action.ContentModify:
                return this._executeRemoteContentModify(action, request);
            case Action.DescriptionInfo:
                return this._executeRemoteDescriptionInfo(action, request);
            case Action.TransportInfo:
                return this._executeRemoteTransportInfo(action, request);
            case Action.TransportReplace:
                return this._executeRemoteTransportReplace(action, request);
            case Action.TransportAccept:
                return this._executeRemoteTransportAccept(action, request);
            case Action.TransportReject:
                return this._executeRemoteTransportReject(action, request);
        }
    }

    public executeLocalRequest(action: Action, request?: RequestContent): Promise<RequestContent> {
        switch (action) {
            case Action.ContentAdd:
                return this._executeLocalContentAdd(action);
            case Action.ContentAccept:
                return this._executeLocalContentAccept(action);
            case Action.ContentReject:
                return this._executeLocalContentReject(action);
            case Action.ContentRemove:
                return this._executeLocalContentRemove(action);
            case Action.ContentModify:
                return this._executeLocalContentModify(action, request);
            case Action.DescriptionInfo:
                return this._executeLocalDescriptionInfo(action, request);
            case Action.TransportInfo:
                return this._executeLocalTransportInfo(action, request);
            case Action.TransportReplace:
                return this._executeLocalTransportReplace(action, request);
            case Action.TransportAccept:
                return this._executeLocalTransportAccept(action);
            case Action.TransportReject:
                return this._executeLocalTransportReject(action);
        }
    }

    private _executeRemoteContentAdd(action: Action, request: RequestContent): Promise<void> {
        this.state = ContentState.Pending;
        this.application = this.session.createApplication(this, request.application);
        this.transport = this.session.createTransport(this, request.transport);
        if (!this.application) {
            this.end({
                condition: ReasonCondition.UnsupportedApplications
            });
            return Promise.resolve();
        }
        if (!this.transport) {
            this.end({
                condition: ReasonCondition.UnsupportedTransports
            });
            return Promise.resolve();
        }

        const okTransport = this.application.validateTransport(this.transport);
        if (okTransport) {
            this.application.setTransport(this.transport);
        } else {
            // TODO: How do we pick a replacement transport?
        }

        return Promise.resolve();
    }

    private _executeRemoteContentAccept(action: Action, request: RequestContent): Promise<void> {
        this.state = ContentState.Active;
        return Promise.all([
            this.application.applyAnswer(request.application),
            this.transport.applyAnswer(request.transport)
        ]).then(() => null).catch(this.end);
    }

    private _executeRemoteContentReject(action: Action, request: RequestContent): Promise<void> {
        this.state = ContentState.Rejected;
        if (this.application) {
            this.application.end();
        }
        if (this.transport) {
            this.transport.end();
        }
        return Promise.resolve();
    }

    private _executeRemoteContentRemove(action: Action, request: RequestContent): Promise<void> {
        this.state = ContentState.Removed;
        if (this.application) {
            this.application.end();
        }
        if (this.transport) {
            this.transport.end();
        }
        return Promise.resolve();
    }

    private _executeRemoteContentModify(action: Action, request: RequestContent): Promise<void> {
        const newDirection = sendersToDirection(this.session.role, request.senders);
        this.application.changeDirection(newDirection);
        return Promise.resolve();
    }

    private _executeRemoteDescriptionInfo(action: Action, request: RequestContent): Promise<void> {
        this.application.applyInfo(request.application);
        return Promise.resolve();
    }

    private _executeRemoteTransportInfo(action: Action, request: RequestContent): Promise<void> {
        this.transport.applyInfo(request.transport);
        return Promise.resolve();
    }

    private _executeRemoteTransportReplace(action: Action, request: RequestContent): Promise<void> {
        const transport = this.session.createTransport(this, request.transport);
        if (!transport) {
            this.rejectTransport();
        }
        if (!this.application.validateTransport(transport)) {
            this.rejectTransport();
        }

        this.replacementTransport = transport;
        this.acceptTransport();

        return Promise.resolve();
    }

    private _executeRemoteTransportAccept(action: Action, request: RequestContent): Promise<void> {
        const oldTransport = this.transport;
        this.transport = this.replacementTransport;
        this.application.setTransport(this.replacementTransport);
        this.replacementTransport = null;
        oldTransport.end();

        return Promise.resolve();
    }

    private _executeRemoteTransportReject(action: Action, request: RequestContent): Promise<void> {
        this.replacementTransport.end();
        this.replacementTransport = null;
        return Promise.resolve();
    }

    private _executeLocalContentAdd(action: Action): Promise<RequestContent> {
        // Don't run through content setup if the session has not been started
        if (this.session.state === SessionState.Starting) {
            return Promise.resolve({
                creator: this.creator,
                name: this.name
            });
        }

        return Promise.all([
            <any>this.application.createOffer(),
            <any>this.transport.createOffer()
        ]).then((offers: [ApplicationDescription, TransportDescription]) => {
            this.state = ContentState.Unacked;
            return {
                creator: this.creator,
                name: this.name,
                senders: this.senders,
                dipsosition: this.disposition,
                application: offers[0],
                transport: offers[1]
            };
        }).catch(this.end);
    }

    private _executeLocalContentAccept(action: Action): Promise<RequestContent> {
        return Promise.all([
            <any>this.application.createAnswer(),
            <any>this.transport.createAnswer()
        ]).then((answers: [ApplicationDescription, TransportDescription]) => {
            return {
                creator: this.creator,
                name: this.name,
                senders: this.senders,
                dipsosition: this.disposition,
                application: answers[0],
                transport: answers[1]
            };
        }).catch(this.end);
    }

    private _executeLocalContentReject(action: Action): Promise<RequestContent> {
        this.state = ContentState.Rejected;
        if (this.application) {
            this.application.end();
        }
        if (this.transport) {
            this.transport.end();
        }
        return Promise.resolve({
            creator: this.creator,
            name: this.name
        });
    }

    private _executeLocalContentRemove(action: Action): Promise<RequestContent> {
        this.state = ContentState.Removed;
        if (this.application) {
            this.application.end();
        }
        if (this.transport) {
            this.transport.end();
        }
        return Promise.resolve({
            creator: this.creator,
            name: this.name
        });
    }

    private _executeLocalContentModify(action: Action, request: RequestContent): Promise<RequestContent> {
        const newDirection = sendersToDirection(this.session.role, request.senders);
        return this.application.changeDirection(newDirection).then(() => {
            this.senders = request.senders;
            this.unackedSendersChange = request.senders;

            return {
                creator: this.creator,
                name: this.name,
                senders: request.senders
            };
        });
    }

    private _executeLocalDescriptionInfo(action: Action, request: RequestContent): Promise<RequestContent> {
        // TODO: How does this one work?
        return Promise.resolve({
            creator: this.creator,
            name: this.name,
            application: request.application
        });
    }

    private _executeLocalTransportInfo(action: Action, request: RequestContent): Promise<RequestContent> {
        // TODO: How does this one work?
        return Promise.resolve({
            creator: this.creator,
            name: this.name,
            transport: request.transport
        });
    }

    private _executeLocalTransportReplace(action: Action, request: RequestContent): Promise<RequestContent> {
        if (this.replacementTransport) {
            this.replacementTransport.end();
        }

        this.replacementTransport = <Transport>request.transport;
        return this.replacementTransport.createOffer().then(offer => {
            return {
                creator: this.creator,
                name: this.name,
                transport: offer
            };
        });
    }

    private _executeLocalTransportAccept(action: Action): Promise<RequestContent> {
        const oldTransport = this.transport;
        this.transport = this.replacementTransport;
        this.application.setTransport(this.replacementTransport);
        this.replacementTransport = null;
        oldTransport.end();

        return Promise.resolve({
            creator: this.creator,
            name: this.name
        });
    }

    private _executeLocalTransportReject(action: Action): Promise<RequestContent> {
        this.replacementTransport.end();
        this.replacementTransport = null;
        return Promise.resolve({
            creator: this.creator,
            name: this.name
        });
    }
}
