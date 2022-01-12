import { Chance } from "chance";

export default class UserSignInFixture {
    constructor() {
        this.chance = new Chance();
    }

    UserSession(username = "", browserAgent = "") {
        return {
            userId: this.chance.guid(),
            username: username ?? this.chance.name(),
            browserUserAgent: browserAgent ?? this.chance.word(),
        };
    }

    UserInfo() {
        return {
            name: this.chance.name(),
        };
    }

    SignInPayload(username, browserAgent) {
        return {
            ss: this.UserSession(username, browserAgent),
            username: username ?? this.chance.name(),
        };
    }
}
