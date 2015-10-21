import {
    Ack,
    Request,
    SessionRole,
    SessionState,
    octetCompare,
    Application,
    Transport,
    ApplicationDescription,
    TransportDescription,
    ApplicationFactory,
    TransportFactory,
    ContentDirection,
    SignalLayer,
    SessionEventHandler,
    ContentEventHandler
} from './definitions';

import Action from './Action';
import Session from './Session';
import Content from './Content';

import * as uuid from 'uuid';


export default class SessionManager {
    private me: string;
    private signalLayer: SignalLayer;
    private sessions: Map<string, Map<string, Session>>;
    private applicationRegistry: Map<string, ApplicationFactory>;
    private transportRegistry: Map<string, TransportFactory>;
    private onSessionHandlers: Set<SessionEventHandler>;

    constructor () {
        this.sessions = new Map();
        this.applicationRegistry = new Map();
        this.transportRegistry = new Map();

        this.onSessionHandlers = new Set();
    }

    public onSession(handler: SessionEventHandler) {
        this.onSessionHandlers.add(handler);
    }

    public fireSessionEvent(session: Session) {
        this.onSessionHandlers.forEach(handler => handler(session));
    }

    public registerSignalLayer(signalLayer: SignalLayer) {
        this.signalLayer = signalLayer;
        this.signalLayer.useSessionManager(this);
    }

    public registerApplicationType(name: string, factory: ApplicationFactory) {
        this.applicationRegistry.set(name, factory);
    }

    public registerTransportType(name: string, factory: TransportFactory) {
        this.transportRegistry.set(name, factory);
    }

    public createApplication(direction: ContentDirection, desc: ApplicationDescription): Application {
        const factory = this.applicationRegistry.get(desc.applicationType);
        if (!factory) {
            return null;
        }
        return factory(direction, desc);
    }

    public createTransport(desc: TransportDescription): Transport {
        const factory = this.transportRegistry.get(desc.transportType);
        if (!factory) {
            return null;
        }
        return factory(desc);
    }

    public createSession(peer: string, me: string): Session {
        let sid: string = uuid.v4();
        while (!!this.getSession(peer, sid)) {
            sid = <string>uuid.v4();
        }

        let session = new Session(this, sid, me, peer, SessionRole.Initiator);

        let peerSessions = this.getSessions(session.peer);
        peerSessions.set(session.sid, session);

        return session;
    }

    public getSessions(peer: string): Map<string, Session> {
        let sessions = this.sessions.get(peer);
        if (!sessions) {
            sessions = new Map();
            this.sessions.set(peer, sessions);
        }
        return sessions;
    }

    public getSession(peer: string, sid: string): Session {
        let peerSessions = this.getSessions(peer);
        return peerSessions.get(sid);
    }

    public processRequest(request: Request, peer: string, me: string): Promise<Ack> {
        request.action = Action.create(request.action);

        return new Promise<Ack>((resolve, reject) => {
            let peerSessions = this.getSessions(peer);
            let session = peerSessions.get(request.sid);

            if (session && (session.state === SessionState.Pending || session.state === SessionState.Active)) {
                return session.processRequest(request).then(resolve, reject);
            }

            if (request.action !== Action.SessionInitiate) {
                return reject(Ack.UnknownSession);
            }

            let equivalentSessions: Promise<Session>[] = [];
            peerSessions.forEach(function(session: Session, sid: string) {
                equivalentSessions.push(session.equivalent(request).then(equivalent => {
                    if (equivalent) {
                        return session;
                    }
                }));
            });

            Promise.all(equivalentSessions).then(equivalentSessions => {
                let pendingSession: Session = null;
                for (let i = 0; i < equivalentSessions.length; i++) {
                    if (equivalentSessions[i]) {
                        pendingSession = equivalentSessions[i];
                        break;
                    }
                }

                if (pendingSession) {
                    const sidOrder = octetCompare(request.sid, pendingSession.sid);

                    if (sidOrder < 0) {
                        // Accept processing of new session
                    } else if (sidOrder > 0) {
                        return reject(Ack.TieBreak);
                    } else {
                        const userOrder = octetCompare(peer, me);

                        if (userOrder < 0) {
                            // Accept processing of new session
                        } else if (userOrder > 0) {
                            return reject(Ack.TieBreak);
                        } else {
                            return reject(Ack.BadRequest);
                        }
                    }
                }

                session = new Session(this, request.sid, peer, me, SessionRole.Responder);
                peerSessions.set(session.sid, session);

                session.processRequest(request).then(ack => {
                    resolve(ack);
                    this.fireSessionEvent(session);
                }, reject);
            });
        });
    }

    public signal(peer: string, me: string, request: Request): Promise<Ack|void> {
        if (this.signalLayer) {
            return this.signalLayer.signal(peer, me, request);
        } else {
            return Promise.resolve(Ack.Ok);
        }
    }
}
