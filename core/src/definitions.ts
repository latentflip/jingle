import Action from './Action';
import Content from './Content';
import Session from './session';
import SessionManager from './SessionManager';


export enum SessionState {
    Starting,
    Unacked,
    Pending,
    Active,
    Ended
}

export enum SessionRole {
    Initiator,
    Responder
}

export enum ContentState {
    Starting,
    Unacked,
    Pending,
    Active,
    Rejected,
    Removed
}

export enum ContentSenders {
    Initiator,
    Responder,
    Both,
    None
}

export enum ContentDirection {
    Send,
    Recv,
    SendRecv,
    None
}

export enum Ack {
    Ok,
    BadRequest,
    OutOfOrder,
    TieBreak,
    UnknownSession
}

export enum ReasonCondition {
    AlternativeSession,
    Busy,
    Cancel,
    ConnectivityError,
    Decline,
    Expired,
    FailedApplication,
    FailedTransport,
    GeneralError,
    Gone,
    IncompatibleParameters,
    MediaError,
    SecurityError,
    Success,
    Timeout,
    UnsupportedApplications,
    UnsupportedTransports
}

export const Disposition = {
    Session: 'session',
    EarlySession: 'early-session'
};

export interface Reason {
    condition: ReasonCondition;
    text?: string;
    sid?: string;
}

export interface Info {
    infoType: string;
}

export interface Request {
    action: Action;
    sid?: string;
    initiator?: string;
    responder?: string;
    contents?: Array<RequestContent>;
    info?: Info;
    reason?: Reason;
}

export interface LocalRequest {
    action: Action;
    sid?: string;
    initiator?: string;
    responder?: string;
    contents?: Array<Content>;
    info?: Info;
    reason?: Reason;
}

export interface RequestContent {
    creator: SessionRole;
    name: string;
    senders?: ContentSenders;
    disposition?: string;
    application?: ApplicationDescription;
    transport?: TransportDescription | Transport;
}

export interface ContentOptions {
    name: string;
    creator?: SessionRole;
    senders?: ContentSenders;
    disposition?: string;
    application?: Application;
    transport?: Transport;
}

export interface SessionStats {
    state: SessionState;
    contents: Array<ContentStats>;
}

export interface ContentStats {
    creator: SessionRole;
    name: string;
    senders: ContentSenders;
    state: ContentState;
}

export interface Application {
    applicationType: string;
    equivalent: (request: RequestContent) => boolean;
    validateTransport: (transport: Transport) => boolean;
    setTransport: (transport: Transport) => Promise<void>;
    createOffer: () => Promise<ApplicationDescription>;
    createAnswer: () => Promise<ApplicationDescription>;
    applyOffer: (desc: ApplicationDescription) => Promise<void>;
    applyAnswer: (desc: ApplicationDescription) => Promise<void>;
    applyInfo: (desc: ApplicationDescription) => Promise<void>;
    changeDirection: (direction: ContentDirection) => Promise<void>;
    getStats: () => Promise<void>;
    end: () => void;
}

export interface Transport {
    transportType: string;
    inband: boolean;
    getStats: () => Promise<void>;
    createOffer: () => Promise<TransportDescription>;
    createAnswer: () => Promise<TransportDescription>;
    applyOffer: (desc: TransportDescription) => Promise<void>;
    applyAnswer: (desc: TransportDescription) => Promise<void>;
    applyInfo: (desc: TransportDescription) => Promise<void>;
    openStreamChannel: () => Promise<void>;
    openDatagramChannel: () => Promise<void>;
    end: () => void;
}

export interface ApplicationDescription {
    applicationType: string;
}

export interface TransportDescription {
    transportType: string;
}

export interface SignalLayer {
    signal: (to: string, from: string, request: Request) => Promise<Ack>;
    useSessionManager: (manager: SessionManager) => void;
}

export enum RequestSource {
    Local = 0,
    Inspection = 1,
    Remote = 2,
    Wait = 3
}

export enum InspectionAction {
    Equivalent,
    Stats,
    Content
}

export interface InspectionRequest {
    action: InspectionAction;
    creator?: SessionRole;
    name?: string;
    request?: Request;
}

export interface ProcessingTask {
    source: RequestSource;
    request?: Request | InspectionRequest;
    resolve: (result?: Ack | Content | boolean | any) => void;
    reject: (result?: Ack | any) => void;
}

export type ApplicationFactory = (direction: ContentDirection, desc: ApplicationDescription) => Application;
export type TransportFactory = (desc: TransportDescription) => Transport;
export type ReplyCallback = (ack: Ack, done?: () => void) => void;
export type InspectionCallback = (err: boolean, result?: any) => void;
export type SessionEventHandler = (session: Session) => void;
export type ContentEventHandler = (content: Content) => void;


export function octetCompare(str1: string, str2: string): number {
    let b1 = new Buffer(str1, 'utf8');
    let b2 = new Buffer(str2, 'utf8');

    return b1.compare(b2);
}

export function reduceAcks(acks: Ack[]): Ack {
    return acks.reduce((prev, current) => {
        switch (current) {
            case Ack.BadRequest:
                return Ack.BadRequest;
            case Ack.TieBreak:
                return (prev !== Ack.BadRequest) ? Ack.TieBreak : prev;
            case Ack.OutOfOrder:
                return (!prev || prev === Ack.Ok) ? Ack.OutOfOrder : prev;
            case Ack.Ok:
                return prev;
        }
    }, Ack.Ok);
}

export function mapFilter<N, T>(map: Map<N, T>, filter: (item: T) => boolean): Map<N, T> {
    let found: Map<N, T> = new Map();
    map.forEach((item: T, name: N) => {
        if (filter(item)) {
            found.set(name, item);
        }
    });
    return found;
}
