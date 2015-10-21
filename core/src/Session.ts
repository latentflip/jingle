import {
    Request,
    LocalRequest,
    Reason,
    RequestContent,
    Ack,
    SessionRole,
    SessionState,
    ContentState,
    ContentSenders,
    ContentOptions,
    Disposition,
    SessionStats,
    mapFilter,
    reduceAcks,
    Application,
    ApplicationDescription,
    Transport,
    TransportDescription,
    ContentDirection,
    ReasonCondition,
    RequestSource,
    InspectionAction,
    InspectionRequest,
    ProcessingTask,
    ReplyCallback,
    InspectionCallback
} from './definitions';

import Action from './Action';
import Content from './Content';
import SessionManager from './SessionManager';

import * as async from 'async';


export default class Session {
    public manager: SessionManager;
    public sid: string;
    public initiator: string;
    public responder: string;
    public role: SessionRole;
    public state: SessionState;
    public contents: Map<SessionRole, Map<string, Content>>;
    private _processingQueue: AsyncPriorityQueue<ProcessingTask>;

    constructor(manager: SessionManager, sid: string, initiator: string, responder: string, role: SessionRole) {
        this.manager = manager;

        this.sid = sid;
        this.initiator = initiator;
        this.responder = responder;
        this.role = role;
        this.state = SessionState.Starting;

        this.contents = new Map();
        this.contents.set(SessionRole.Initiator, new Map());
        this.contents.set(SessionRole.Responder, new Map());

        this._processingQueue = async.priorityQueue(this._processingQueueRunner.bind(this), 1);
    }

    public get me(): string {
        return this.role === SessionRole.Initiator ? this.initiator : this.responder;
    }

    public get peer(): string {
        return this.role === SessionRole.Initiator ? this.responder : this.initiator;
    }

    public get peerRole(): SessionRole {
        return this.role === SessionRole.Initiator ? SessionRole.Responder : SessionRole.Initiator;
    }

    public equivalent(request: Request): Promise<boolean> {
        return new Promise<any>((resolve, reject) => {
            this._processingQueue.push({
                source: RequestSource.Inspection,
                request: {
                    action: InspectionAction.Equivalent,
                    request: request
                },
                resolve,
                reject
            }, RequestSource.Inspection);
        });
    }

    public start(): Promise<Ack> {
        return this._prepareForProcessing({
            action: Action.SessionInitiate
        }, RequestSource.Local);
    }

    public accept(): Promise<Ack> {
        return this._prepareForProcessing({
            action: Action.SessionAccept
        }, RequestSource.Local);
    }

    public end(reason?: Reason): Promise<Ack> {
        return this._prepareForProcessing({
            action: Action.SessionTerminate,
            reason: reason
        }, RequestSource.Local);
    }

    public getContent(creator: SessionRole, name: string): Promise<Content> {
        return new Promise<any>((resolve, reject) => {
            this._processingQueue.push({
                source: RequestSource.Inspection,
                request: {
                    action: InspectionAction.Content,
                    creator,
                    name
                },
                resolve,
                reject
            }, RequestSource.Inspection);
        });
    }

    public createContent(opts: ContentOptions): Content {
        const content = new Content(this, {
            name: opts.name,
            creator: this.role,
            senders: opts.senders,
            disposition: opts.disposition,
            application: opts.application,
            transport: opts.transport
        });
        return content;
    }

    public addContent(content: Content): Promise<Ack> {
        return this._prepareForProcessing({
            action: Action.ContentAdd,
            contents: [ content ]
        }, RequestSource.Local);
    }

    public removeContent({ creator = this.role, name }: ContentOptions, reason?: Reason): Promise<Ack> {
        return this._prepareForProcessing({
            action: Action.ContentRemove,
            contents: [{ creator, name }],
            reason: reason
        }, RequestSource.Local);
    }

    public getStats(): Promise<SessionStats> {
        return new Promise<SessionStats>((resolve, reject) => {
            this._processingQueue.push({
                source: RequestSource.Inspection,
                request: { action: InspectionAction.Stats },
                resolve,
                reject
            }, RequestSource.Inspection);
        });
    }

    public wait(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._processingQueue.push({
                source: RequestSource.Wait,
                request: { action: null },
                resolve,
                reject
            }, RequestSource.Wait);
        });
    }

    public processRequest(request: Request): Promise<Ack> {
        return this._prepareForProcessing(request, RequestSource.Remote);
    }

    public processLocalRequest(request: Request): Promise<Ack> {
        return this._prepareForProcessing(request, RequestSource.Local);
    }

    public createApplication(content: Content, desc: ApplicationDescription): Application {
        return this.manager.createApplication(content.direction, desc);
    }

    public createTransport(content: Content, desc: TransportDescription): Transport {
        return this.manager.createTransport(desc);
    }

    private _getContent(creator: SessionRole, name: string): Content {
        return this.contents.get(creator).get(name);
    }

    private _removeContent(creator: SessionRole, name: string): void {
        this.contents.get(creator).delete(name);
    }

    private _forAllContent(handler: (content: Content) => void) {
        this.contents.get(this.role).forEach(handler);
        this.contents.get(this.peerRole).forEach(handler);
    }

    private _sendRequest(request: Request): Promise<Ack> {
        request.sid = this.sid;
        return this.manager.signal(this.peer, this.me, request);
    }

    private _prepareForProcessing(request: Request, source: RequestSource): Promise<Ack> {
        if (!request.contents) {
            request.contents = [];
        }

        return new Promise<Ack>((resolve, reject) => {
            this._processingQueue.push({ source, request, resolve, reject }, source);
        });
    }

    private _processingQueueRunner(task: ProcessingTask, next: () => void): void {
        const reply = (ack: Ack, done?: () => void) => {
            if (ack === Ack.Ok) {
                task.resolve(ack);
            } else {
                task.reject(ack);
            }
            if (done) {
                done();
            }
        };

        switch (task.source) {
            case RequestSource.Local:
                this._executeLocalRequest(<LocalRequest>task.request, reply, next);
                break;
            case RequestSource.Remote:
                this._executeRemoteRequest(<Request>task.request, reply, next);
                break;
            case RequestSource.Wait:
                task.resolve();
                next();
                break;
            case RequestSource.Inspection:
                this._executeInspectionRequest(<InspectionRequest>task.request, (err: boolean, result: any) => {
                    if (!err) {
                        task.resolve(result);
                    } else {
                        task.reject();
                    }
                    next();
                });
                break;
        }
    }

    private _executeInspectionRequest(request: InspectionRequest, reply: InspectionCallback): void {
        switch (request.action) {
            case InspectionAction.Content:
                const content = this._getContent(request.creator, request.name);
                reply(!!!content, content);
                break;
            case InspectionAction.Equivalent:
                const equivalentContents = mapFilter(this.contents.get(this.role), content => {
                    return content.equivalent(request.request.contents) && content.state === ContentState.Unacked;
                });
                reply(null, this.state === SessionState.Unacked && equivalentContents.size > 0);
                break;
            case InspectionAction.Stats:
                let stats: SessionStats = {
                    state: this.state,
                    contents: []
                };
                this._forAllContent(content => {
                    stats.contents.push({
                        creator: content.creator,
                        name: content.name,
                        state: content.state,
                        senders: content.senders
                    });
                });
                reply(null, stats);
                break;
        }
    }

    private _executeRemoteRequest(request: Request, reply: ReplyCallback, done: () => void): void {
        const contentAction = request.action.contentAction();
        const amInitiator = this.role === SessionRole.Initiator;
        const isStarting = this.state === SessionState.Starting;
        const isPending = this.state === SessionState.Pending;

        if (request.action === Action.SessionInitiate && (amInitiator || !isStarting)) {
            return reply(Ack.OutOfOrder, done);
        }
        if (request.action === Action.SessionAccept && (!amInitiator || !isPending)) {
            return reply(Ack.OutOfOrder, done);
        }
        if (request.action.requiresContent() && (!request.contents || request.contents.length === 0)) {
            return reply(Ack.BadRequest, done);
        }
        if (amInitiator && contentAction === Action.ContentAdd) {
            const equivalents = mapFilter(this.contents.get(this.role), content => {
                return content.equivalent(request.contents) && content.state === ContentState.Unacked;
            });
            if (equivalents.size > 0) {
                return reply(Ack.TieBreak, done);
            }
        }

        let validationResults: Ack[] = [];
        let newContents: Content[] = [];
        request.contents.forEach(requestContent => {
            if (contentAction === Action.ContentAdd) {
                const newContent = new Content(this, {
                    creator: this.peerRole,
                    name: requestContent.name,
                    senders: requestContent.senders,
                    disposition: requestContent.disposition
                });
                const ack = newContent.validateRemoteRequest(contentAction, requestContent);
                if (ack === Ack.Ok) {
                    newContents.push(newContent);
                }
                validationResults.push(ack);
            } else {
                const localContent = this._getContent(requestContent.creator, requestContent.name);
                if (localContent) {
                    validationResults.push(localContent.validateRemoteRequest(contentAction, requestContent));
                } else {
                    validationResults.push(Ack.BadRequest);
                }
            }
        });

        const validationAck = reduceAcks(validationResults);
        if (validationAck === Ack.Ok) {
            newContents.forEach(content => {
                this.contents.get(content.creator).set(content.name, content);
            });
            reply(Ack.Ok);
        } else {
            return reply(validationAck, done);
        }

        // Now we can actually execute the request

        let cleanup = () => {
            this._executeRemoteCleanup(contentAction, request, done);
        };

        switch (request.action) {
            case Action.SessionInitiate:
                this.state = SessionState.Pending;
                break;
            case Action.SessionAccept:
                this.state = SessionState.Active;
                break;
            case Action.SessionTerminate:
                this.state = SessionState.Ended;
                let endedContents: Promise<void>[] = [];
                this._forAllContent(content => {
                    endedContents.push(content.executeRemoteRequest(contentAction));
                });
                Promise.all(endedContents).then(cleanup, cleanup);
                return;
        }

        let results: Promise<void>[] = [];
        request.contents.forEach(request => {
            const content = this._getContent(request.creator, request.name);
            if (content) {
                results.push(content.executeRemoteRequest(contentAction, request));
            }
        });

        Promise.all(results).then(cleanup, cleanup);
    }

    private _executeRemoteCleanup(contentAction: Action, request: Request, done: () => void): void {
        if (contentAction === Action.ContentRemove) {
            request.contents.forEach(content => {
                this._removeContent(content.creator, content.name);
            });
        }

        let localLiveContent = mapFilter(this.contents.get(this.role), content => content.isLive());
        let remoteLiveContent = mapFilter(this.contents.get(this.peerRole), content => content.isLive());

        if (localLiveContent.size === 0 && remoteLiveContent.size === 0) {
            this.end({ condition: ReasonCondition.Success });
        }

        done();
    }

    private _executeLocalRequest(request: LocalRequest, reply: ReplyCallback, done: () => void): void {
        const contentAction = request.action.contentAction();
        const amInitiator = this.role === SessionRole.Initiator;
        const isStarting = this.state === SessionState.Starting;
        const isPending = this.state === SessionState.Pending;
        const isEnded = this.state === SessionState.Ended;

        if (request.action === Action.SessionInitiate && (!amInitiator && !isStarting)) {
            return reply(Ack.OutOfOrder, done);
        }
        if (request.action === Action.SessionAccept && (amInitiator && isPending)) {
            return reply(Ack.OutOfOrder, done);
        }
        if (request.action === Action.SessionTerminate && isEnded) {
            return reply(Ack.Ok, done);
        }

        let validationResults: Ack[] = [];
        let newContents: Content[] = [];
        request.contents.forEach(requestContent => {
            if (contentAction === Action.ContentAdd) {
                const ack = requestContent.validateLocalRequest(contentAction, requestContent);
                if (ack === Ack.Ok) {
                    newContents.push(requestContent);
                }
                validationResults.push(ack);
            } else {
                const localContent = this._getContent(requestContent.creator, requestContent.name);
                if (localContent) {
                    validationResults.push(localContent.validateLocalRequest(contentAction, requestContent));
                } else {
                    validationResults.push(Ack.BadRequest);
                }
            }
        });
        const validationAck = reduceAcks(validationResults);

        if (validationAck !== Ack.Ok) {
            return reply(validationAck, done);
        } else {
            newContents.forEach(content => {
                this.contents.get(content.creator).set(content.name, content);
            });
        }

        // Now we can actually execute the request

        let results: Promise<RequestContent>[] = [];
        request.contents.forEach(request => {
            const content = this._getContent(request.creator, request.name);
            if (content) {
                results.push(content.executeLocalRequest(contentAction, request));
            }
        });
        Promise.all(results).then(contents => {
            switch (request.action) {
                case Action.SessionInitiate:
                    this._executeLocalSessionInitiate(request, contents, reply);
                    break;
                case Action.SessionAccept:
                    this._executeLocalSessionAccept(request, contents, reply);
                    break;
                case Action.SessionTerminate:
                    this._executeLocalSessionTerminate(request, contents, reply);
                    break;
                case Action.ContentAdd:
                    this._executeLocalContentAdd(request, contents, reply);
                    break;
                case Action.ContentRemove:
                    this._executeLocalContentRemove(request, contents, reply);
                    break;
                case Action.ContentAccept:
                    this._executeLocalContentAccept(request, contents, reply);
                    break;
                default:
                    this._sendRequest({
                        action: request.action,
                        contents: contents,
                        reason: request.reason
                    }).then(reply, reply);
            }
            return done();
        }).catch(error => {
            reply(error, done);
        });
    }

    private _executeLocalSessionInitiate(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        let offers: Promise<RequestContent>[] = [];
        let offerContents: Content[] = [];

        this.state = SessionState.Unacked;

        this.contents.get(this.role).forEach(content => {
            if (content.state === ContentState.Starting && content.disposition === Disposition.Session) {
                offers.push(content.executeLocalRequest(Action.ContentAdd));
                offerContents.push(content);
            }
        });

        if (offerContents.length === 0) {
            return reply(Ack.BadRequest);
        }

        Promise.all(offers).then(offers => {
            this._sendRequest({
                action: request.action,
                initiator: this.initiator,
                contents: offers
            }).then(ack => {
                this.state = SessionState.Pending;
                offerContents.forEach(content => {
                    content.state = ContentState.Pending;
                });
                reply(ack);
            }).catch(err => {
                reply(err);
            });
        });
    }

    private _executeLocalSessionAccept(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        let answers: Promise<RequestContent>[] = [];
        let answerContents: Content[] = [];

        this.contents.get(this.peerRole).forEach(content => {
            if (content.state === ContentState.Pending && content.disposition === Disposition.Session) {
                answers.push(content.executeLocalRequest(Action.ContentAccept));
                answerContents.push(content);
            }
        });

        if (answerContents.length === 0) {
            return reply(Ack.BadRequest);
        }

        Promise.all(answers).then(answers => {
            this._sendRequest({
                action: request.action,
                responder: this.responder,
                contents: answers
            }).then(ack => {
                this.state = SessionState.Active;
                answerContents.forEach(content => {
                    content.state = ContentState.Active;
                });
                reply(ack);
            }).catch(err => {
                reply(err);
            });
        }).catch(err => {
            reply(err);
        });
    }

    private _executeLocalSessionTerminate(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        let endAllContent: Promise<RequestContent>[] = [];
        this._forAllContent(content => {
            endAllContent.push(content.executeLocalRequest(Action.ContentRemove));
        });

        Promise.all(endAllContent).then(offers => {
            if (this.state !== SessionState.Ended) {
                this.state = SessionState.Ended;
                this._sendRequest({
                    action: request.action,
                    reason: request.reason
                }).then(ack => {
                    reply(Ack.Ok);
                }).catch(err => {
                    reply(Ack.Ok);
                });
            } else {
                reply(Ack.Ok);
            }
        }).catch(err => {
            reply(Ack.Ok);
        });
    }

    private _executeLocalContentAdd(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        if (this.state === SessionState.Starting) {
            reply(Ack.Ok);
            return;
        }

        this._sendRequest({
            action: request.action,
            contents: contents
        }).then(ack => {
            contents.forEach(contentRequest => {
                const localContent = this._getContent(contentRequest.creator, contentRequest.name);
                localContent.state = ContentState.Pending;
            });
            reply(ack);
        }).catch(err => {
            reply(err);
        });
    }

    private _executeLocalContentRemove(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        contents.forEach(requestContent => {
            this._removeContent(requestContent.creator, requestContent.name);
        });

        if (this.state === SessionState.Starting) {
            reply(Ack.Ok);
            return;
        }

        this._sendRequest({
            action: request.action,
            contents: contents,
            reason: request.reason
        }).then(reply, reply);
    }

    private _executeLocalContentAccept(request: Request, contents: RequestContent[], reply: ReplyCallback): void {
        this._sendRequest({
            action: request.action,
            contents: contents
        }).then(ack => {
            contents.forEach(contentRequest => {
                const localContent = this._getContent(contentRequest.creator, contentRequest.name);
                localContent.state = ContentState.Active;
            });
            reply(ack);
        }).catch(err => {
            reply(err);
        });
    }
}
