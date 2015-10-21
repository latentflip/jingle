export default class Action {
    public value: string;
    private static actions: Map<string, Action> = new Map();

    static ContentAccept = new Action('content-accept');
    static ContentAdd = new Action('content-add');
    static ContentModify = new Action('content-modify');
    static ContentReject = new Action('content-reject');
    static ContentRemove = new Action('content-remove');
    static DescriptionInfo = new Action('description-info');
    static SessionAccept = new Action('session-accept');
    static SessionInfo = new Action('session-info');
    static SessionInitiate = new Action('session-initiate');
    static SessionTerminate = new Action('session-terminate');
    static TransportAccept = new Action('transport-accept');
    static TransportInfo = new Action('transport-info');
    static TransportReject = new Action('transport-reject');
    static TransportReplace = new Action('transport-replace');

    public static create(value: Action | string): Action {
        if (typeof value === 'string') {
            return Action.actions.get(value);
        } else {
            return Action.actions.get(value.value);
        }
    }

    constructor(value: string) {
        this.value = value;
        Action.actions.set(value, this);
    }

    public toString(): string {
        return this.value;
    }

    public contentAction(): Action {
        switch (this.value) {
            case Action.SessionInitiate.value:
                return Action.ContentAdd;
            case Action.SessionAccept.value:
                return Action.ContentAccept;
            case Action.SessionTerminate.value:
                return Action.ContentRemove;
            default:
                return this;
        }
    }

    public requiresContent(): boolean {
        switch (this.value) {
            case Action.SessionTerminate.value:
                return false;
            case Action.SessionInfo.value:
                return false;
            case Action.DescriptionInfo.value:
                return false;
            case Action.TransportInfo.value:
                return false;
            default:
                return true;
        }
    }
}
