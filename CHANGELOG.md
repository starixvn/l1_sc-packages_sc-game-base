## [1.15.3](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.15.2...v1.15.3) (2020-11-04)


### Bug Fixes

* incorrect async/await call of inGameConsumer in base-socket-router ([d29ffcf](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d29ffcf29a75c729242a5097e4a5ffc28e047e7f))
* initSocketRouter ([f608a1f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/f608a1f12f754451f61168fc309e85fc6ed48ddb))
* move process disabled bots to table game, limit number of bots to add if reach limit ([6b84a80](https://git3.nexdev.net/sc-packages/sc-game-base/commit/6b84a80a017fcf07c06c9a1624902772b4923205))
* remove code test bot ([a4e4ae9](https://git3.nexdev.net/sc-packages/sc-game-base/commit/a4e4ae969f0a3ecdade4b3b23cc3c98ec8e45473))
* update disabled bots, remove bots immediately if ratio changed ([46fa8a1](https://git3.nexdev.net/sc-packages/sc-game-base/commit/46fa8a10b296b4cb5b3469e5d7cf92e3738259a4))
* update existing bet amount of bot instead of increasement ([0d5d0af](https://git3.nexdev.net/sc-packages/sc-game-base/commit/0d5d0af2d54b148df6d6f399ae42052c7b07ec95))
* upgrade remove bot if ratio changed ([0f3548c](https://git3.nexdev.net/sc-packages/sc-game-base/commit/0f3548c361fc39ff94d261efafc83d9afb9f28f1))

## [1.15.2](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.15.1...v1.15.2) (2020-10-22)


### Bug Fixes

* sending remainingTime when joining table game round ([a39c044](https://git3.nexdev.net/sc-packages/sc-game-base/commit/a39c044a49eeb460de2f351ed981dea81506da32))

## [1.15.1](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.15.0...v1.15.1) (2020-10-22)


### Bug Fixes

* fix SonarQube codesmells ([1a2bba3](https://git3.nexdev.net/sc-packages/sc-game-base/commit/1a2bba3400a85e7230df1982b128397299f0967f))

# [1.15.0](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.14.1...v1.15.0) (2020-10-21)


### Bug Fixes

* authentication-helper ([2def4cf](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2def4cf4a579c0c0cc71dbf3440a2ceb73d52773))
* break the recursive cycle in the method of collecting online users ([1b23121](https://git3.nexdev.net/sc-packages/sc-game-base/commit/1b23121fbf99797bf1a686d6d2d5933068129219))
* change math random to chancejs in table bot ([f69df1c](https://git3.nexdev.net/sc-packages/sc-game-base/commit/f69df1ce983f1c52a098ab718ef67e20d225f31f))
* correct betLogRepository in history-query ([85419a5](https://git3.nexdev.net/sc-packages/sc-game-base/commit/85419a5541eb4b31463c09723739f8d7dbed2e29))
* correct getTicketsPerRound ([ba96a92](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ba96a92908a35fe122d6fd01f487ffe9cf68bebe))
* correct init ingame consumer, set bot default as null in cron ([8136847](https://git3.nexdev.net/sc-packages/sc-game-base/commit/813684771d3bc4143860393ffcd5d0fb3dc2c516))
* move adding player to in-game-consumer of table game ([5acd7e8](https://git3.nexdev.net/sc-packages/sc-game-base/commit/5acd7e8bd3f01dec9c299662d7e972819fa748ca))
* organize parameters ([7a7bf79](https://git3.nexdev.net/sc-packages/sc-game-base/commit/7a7bf794ee6431c88e01197c6112a09495f99099))
* rebase code ([3b2a81f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/3b2a81f79176005fb69bb0db318f9a7c4b2ca128))
* remove bot in definition constructor ([d2bc9bf](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d2bc9bfeb82ebec03e75458720d601558e223197))
* remove totalbets param ([98a3466](https://git3.nexdev.net/sc-packages/sc-game-base/commit/98a34661bf2218e7d0b5f7e0b0c4a892afc50bdc))
* return correct gameConfigs name ([3084acb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/3084acb71c9432b32ad2ec87ed3bc7af28cf2133))
* upgrade sc-base-api package ([983a52b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/983a52baa3474b8bee72e276f10e1d92d0687751))
* upgrade sc-base-database ([29632cc](https://git3.nexdev.net/sc-packages/sc-game-base/commit/29632cc362a7d11dba70b18a2c25492ca625dcb3))
* upgrade sc-base-database package ([482302e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/482302ea112872e882630781bf097260c0b932dd))


### Features

* add currency to ingame object ([90fd467](https://git3.nexdev.net/sc-packages/sc-game-base/commit/90fd4677b775f7daf7048c09359f714df908c29d))
* add inGame event for core ([74c6b0e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/74c6b0e67ba0406818bd28e39da85d8d1e2070aa))
* add um info when ingame ([cc9bc76](https://git3.nexdev.net/sc-packages/sc-game-base/commit/cc9bc7645279173954267f445dd0160829f5ec57))
* check start time in game cron ([d78cbe3](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d78cbe38633cc2adee2f3ba84e4de74ed437317c))
* init authentication-helper globally ([ab856c2](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ab856c2800cf87bddc9cce8c4c695206fae17c0f))
* release pakages ([d0bd9bb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d0bd9bb778825143b9657f03e9bb09061bfbeaf7))
* remain param ([cd90799](https://git3.nexdev.net/sc-packages/sc-game-base/commit/cd9079969202c9af3b849f4b42314fa1a0b3338c))
* rename gameDefinition to definition ([52709e7](https://git3.nexdev.net/sc-packages/sc-game-base/commit/52709e73776aa506c6f0707e8c16b1b0e06c7f19))
* return currency to admin ([519bb55](https://git3.nexdev.net/sc-packages/sc-game-base/commit/519bb55f70efcf451a5303ac8a511263b09f9277))
* update base-game-startup ([b5b26f6](https://git3.nexdev.net/sc-packages/sc-game-base/commit/b5b26f67e746a83e35d2cdba39795ff09c77d272))
* update bot ([9502cbb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/9502cbbd94604244ce1dcd053468cca4c27306d9))
* update core ([c5a0420](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c5a04209735f9a56cfa4a436b97a469dfd67af93))
* update in-game-consumer ([67df319](https://git3.nexdev.net/sc-packages/sc-game-base/commit/67df319700dc14533cf0fc53a23dffd7246a065b))
* update in-game-consumer ([9dfb5be](https://git3.nexdev.net/sc-packages/sc-game-base/commit/9dfb5bebac543bc5d0ef4ee706f1b100ff8fd3b2))
* update ingame ([b226cda](https://git3.nexdev.net/sc-packages/sc-game-base/commit/b226cda0e6c7a553fbf57e937a2a7dacb0c58502))
* update latest balance to players who are disconnected socket ([2c361d5](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2c361d5585ff3c60472b84a122fcd95631ef554c))
* update main server auth ([c10e50e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c10e50e83ccad4ce2864ca765eb4ef5fe55906a4))
* update place-bet-publisher ([e284884](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e284884c0ed80bb397436b22ee80a702f271728b))
* update process-bet-queue ([274c820](https://git3.nexdev.net/sc-packages/sc-game-base/commit/274c820b4aa90f9788551ffe2654f48a3af3f2ba))
* update process-bet-queue ([24190e5](https://git3.nexdev.net/sc-packages/sc-game-base/commit/24190e598576a3a82480b02226b1f13af30801d7))
* update process-bet-queue ([adefcda](https://git3.nexdev.net/sc-packages/sc-game-base/commit/adefcdaf07fce3c50101cb2b6a340cc1aa726da5))
* update round-query ([60bf225](https://git3.nexdev.net/sc-packages/sc-game-base/commit/60bf2256d769014b14c0b5e307c608937a8a09cc))
* update startup ([dbfa887](https://git3.nexdev.net/sc-packages/sc-game-base/commit/dbfa88774e1f06e2e875395eb76a2cd79804a5e0))
* update user-bet-result-publisher ([5815f7d](https://git3.nexdev.net/sc-packages/sc-game-base/commit/5815f7dd5bdca6e56bd2bf3e125e6663d612048e))
* update user-bet-result-publisher ([33f2053](https://git3.nexdev.net/sc-packages/sc-game-base/commit/33f2053aeb9906031e4d581cb9c9cb46fcdfffde))
* update user-bet-result-publisher ([b398d5e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/b398d5ecb9bc38a830e00e30d11eb99900ae33de))

## [1.14.1](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.14.0...v1.14.1) (2020-10-07)


### Bug Fixes

* add await to Promise all ([8fe373c](https://git3.nexdev.net/sc-packages/sc-game-base/commit/8fe373ccd6ea817153d5f12c981ae5ac61278289))
* change foreach to promise all, add exec to find for bot ([db54ecc](https://git3.nexdev.net/sc-packages/sc-game-base/commit/db54ecc8fb8f95cbb551220378dd9476c0d95bea))
* pass round id from bet info when handle success bet ([d0597cb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d0597cb78185c06fed63a98511213ab9627af4cf))
* remove botsInRoom in base bot ([7fe03d3](https://git3.nexdev.net/sc-packages/sc-game-base/commit/7fe03d344e5f2b0b4cdda8006d6a9501c3cfd425))
* update promise all ([f0652f8](https://git3.nexdev.net/sc-packages/sc-game-base/commit/f0652f8b075224d702a6238373869293d050aa10))

# [1.14.0](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0...v1.14.0) (2020-09-30)


### Bug Fixes

* correct logger call ([18f2cd1](https://git3.nexdev.net/sc-packages/sc-game-base/commit/18f2cd136d91e0c11d8aa4288620bdd320c30937))


### Features

* correct npm version ([dae81fa](https://git3.nexdev.net/sc-packages/sc-game-base/commit/dae81fa73c3ca9da15519549d6508e526c27bae0))

# [1.13.0](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.12.5...v1.13.0) (2020-09-16)


### Bug Fixes

* 1.13.0-dev-TableGameBase.63 ([7140b4b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/7140b4b1bb25f12b1d0792498d6fe9b8a392056a))
* add chips when bot place bet ([b7a0e37](https://git3.nexdev.net/sc-packages/sc-game-base/commit/b7a0e377f216b0ca56c1ee94e4433146dbaa573c))
* add choice validation in place bet ([482628d](https://git3.nexdev.net/sc-packages/sc-game-base/commit/482628dc2f9db2d9a76ee8a0c2354854f3555ca6))
* add constraints min bots while random remove ([1183c5d](https://git3.nexdev.net/sc-packages/sc-game-base/commit/1183c5d84b54552a3b4d2f72ade0027564cc3e7d))
* add lean exec (cont) ([9644734](https://git3.nexdev.net/sc-packages/sc-game-base/commit/9644734f44f9fd5a3f64c3c0c25d2c388924ba5f))
* add lean exec (cont) ([159af61](https://git3.nexdev.net/sc-packages/sc-game-base/commit/159af61abffb55b23d3fc2caae88eae20e46a3e5))
* add lean exec after findOne ([0540b7a](https://git3.nexdev.net/sc-packages/sc-game-base/commit/0540b7aa2cb927ec0385cf2fe5a748933664de74))
* add missing await when checking game status ([003b264](https://git3.nexdev.net/sc-packages/sc-game-base/commit/003b264661d61f595581db5f46985ea505015d46))
* add sonar project key ([8997ec6](https://git3.nexdev.net/sc-packages/sc-game-base/commit/8997ec65fb34d312d6ecd892109db60238fe4106))
* add validate disable freeBet ([2596eef](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2596eef90897db9cdf2e5c0b7308e0f01093e8b0))
* admin disconnect ([aac1d3f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/aac1d3f13fbb5a1e72d6b7b6a22fb59956c3fbe2))
* captureBetResult ([b6ec056](https://git3.nexdev.net/sc-packages/sc-game-base/commit/b6ec056606a74615a126ffe1d3c646aceb352ba1))
* change function to lambda ([13a3368](https://git3.nexdev.net/sc-packages/sc-game-base/commit/13a3368d80cf46fca6b59942f65cdcdc1f0d7eb4))
* clean old sockets of just-sign-in user ([6fe0ea7](https://git3.nexdev.net/sc-packages/sc-game-base/commit/6fe0ea7816e68ec39d6d37baffc278ad03d60bb8))
* clean up changelog ([c3e8690](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c3e86903e1bc03e727d0b597c53cbfe75d3d40d4))
* code smells ([a95763b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/a95763bf8a40e64db44508d1a7853e829059099b))
* code smells ([ba5b034](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ba5b0346d7d466d99c1ba2fad52d118df084a983))
* code smells ([eca7c99](https://git3.nexdev.net/sc-packages/sc-game-base/commit/eca7c9978d01101a5fc6e1f6943723dabf96014e))
* code smells ([082607e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/082607ebf463f9a2c01185608b3fe60b85fc429b))
* code smells ([c32d5c7](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c32d5c7cf5ece99d5532b8807c4a08d9262cebe0))
* code smells ([e75fa46](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e75fa4682f9759f9c31e5e8e07dac95e19707d8d))
* code smells ([80a6c44](https://git3.nexdev.net/sc-packages/sc-game-base/commit/80a6c44e58fecbcf9a53f875e37138e2a9b6906f))
* codesmell ([f73fa8a](https://git3.nexdev.net/sc-packages/sc-game-base/commit/f73fa8a681d7895d895bf9046c9f2a672a0e51d3))
* convert settlement result receive null ([683e0f4](https://git3.nexdev.net/sc-packages/sc-game-base/commit/683e0f4ab43c8219dcf9f470d08039a4c3b01f6e))
* correct config name when reset bot in room ([2aa67ca](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2aa67caeb1f7d9d8941c73229b349f7334cf417f))
* correct import ([9f55bae](https://git3.nexdev.net/sc-packages/sc-game-base/commit/9f55bae3d71d6baad45dceecff30b7f2ab107aaa))
* correct imports ([ddb48f5](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ddb48f57f83fd9c2e39dae6a521a5c0aaf4897ad))
* correct imports ([e847e6b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e847e6be4a15abb72f77a23d66064f7955e91de5))
* correct wrong import ([97cd198](https://git3.nexdev.net/sc-packages/sc-game-base/commit/97cd1982ae059d231f8c4c26da418663c19a56bc))
* display message not enough scoin ([caf7dad](https://git3.nexdev.net/sc-packages/sc-game-base/commit/caf7dad00dba4e91b56a4ff59d0a52b2ddfcb7c5))
* export HttpRouter ([e99c2db](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e99c2dbd143db43472402508dfdde6093cf7bdbb))
* export TableGameData, update init of HttpRouter ([089556b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/089556bba1e65d36f6c60588f272204ef51e8414))
* expose convertBet for old structure in history ([aac731a](https://git3.nexdev.net/sc-packages/sc-game-base/commit/aac731ad2ec663c9e10b014aabec39347fe2ceb8))
* handle scoins return from api ([51a502b](https://git3.nexdev.net/sc-packages/sc-game-base/commit/51a502b79217f255cbfc7fb94a7bca3b2e7ca342))
* inject custom round query ([335feeb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/335feeb8a2c3a12430561b68eeb6ff82273ea125))
* log payload when send to admin socket ([e287a65](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e287a651c28032f20e29e4dd45d71ed88e71d743))
* pass round id to get bet logs and fix code smell ([ca24850](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ca24850a672e732441ebdc327e00f8671c6eaf4e))
* random remove bot in room ([46ba5c2](https://git3.nexdev.net/sc-packages/sc-game-base/commit/46ba5c2830ba733905f7455e2aa1df1abafca1fd))
* re-assign active bots after remove ([5d88474](https://git3.nexdev.net/sc-packages/sc-game-base/commit/5d8847407db2eaff416bcd6bd46cfa5ac78569cd))
* remove game data players when user disconnected ([ead223e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ead223ed736a9f63f18fb4119a872eb1b0b53ed0))
* remove red in tempBet  of bot ([952ed6a](https://git3.nexdev.net/sc-packages/sc-game-base/commit/952ed6abeab09797b0662e235b6efc2d3d7eb69e))
* remove unnecessary async await ([56193d1](https://git3.nexdev.net/sc-packages/sc-game-base/commit/56193d10fad33ac30a7a181bd41a9256afc52453))
* remove useless update user info ([dce8308](https://git3.nexdev.net/sc-packages/sc-game-base/commit/dce83085d1ca714b734de11fa4c6a898c7cbc601))
* rename bot files and fix code smells ([8378555](https://git3.nexdev.net/sc-packages/sc-game-base/commit/8378555824c40bad65059b4816803257d0c8d9fd))
* replace all Math.random to chance ([cee8208](https://git3.nexdev.net/sc-packages/sc-game-base/commit/cee8208ace915d2434d71f98fc40d2ae612fa267))
* return winningPlayers to client ([2b1d76e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2b1d76ea89e3f14e12b0b8439b93db41ced7afcd))
* settle game round ([24253db](https://git3.nexdev.net/sc-packages/sc-game-base/commit/24253dbe11d52e091ae40e0161ca636cbe766f53))
* update base-event-publisher ([a00c270](https://git3.nexdev.net/sc-packages/sc-game-base/commit/a00c270f2aff4a80cb2b9cdcfc37b70d3388d8ca))
* update bot ([ec859bc](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ec859bc162d9c1f29947891cdfa88012c9e7854d))
* update ingame ([ca7b689](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ca7b689723d3fe2fa5f48996cb7196c4e6753537))
* update max of random removal bots ([62c7aab](https://git3.nexdev.net/sc-packages/sc-game-base/commit/62c7aabb4feea55634fac041844f0725d8985184))
* update remove bot, add random remove bot on table ([584ca5f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/584ca5f6c07ebf31d8fdf7567fcf66a31e6be985))
* update running-round-info-publisher ([350eb91](https://git3.nexdev.net/sc-packages/sc-game-base/commit/350eb917d9de597da4c4a1febdf466c88464f3ca))
* update running-round-info-publisher ([e5b6e30](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e5b6e30f4a7ff5756f3c11982e0902240f819519))
* update running-round-info-publisher ([d1d4062](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d1d4062fbd306210408882e731e3367b9b39a9f2))
* update sc-base-apis ([adc4a12](https://git3.nexdev.net/sc-packages/sc-game-base/commit/adc4a120ffd27d2bec0e58699ff804d773bdf56b))
* update settleBets ([d64fe13](https://git3.nexdev.net/sc-packages/sc-game-base/commit/d64fe13356a6d18e5210243e6dc920f82b8d3607))
* upgrade new sc-game-base to get/update correct balance when in-game ([c87aabc](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c87aabc75c32c0777f0f5147b9bec23af44ebbeb))
* upgrade package ([bb1d020](https://git3.nexdev.net/sc-packages/sc-game-base/commit/bb1d020d11bb6714bba5dc5c313f95aee1364d87))
* upgrade sc packages to latest ([4fc38d8](https://git3.nexdev.net/sc-packages/sc-game-base/commit/4fc38d819d74cab6c1e6ec1d6b836e49fdc19f21))
* upgrade sc-common package ([37937eb](https://git3.nexdev.net/sc-packages/sc-game-base/commit/37937eb1fe5703d0e902fd691ce01427f44f0e10))


### Features

* add onlineusers for table game base ([4813b7f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/4813b7fcb848c90c52f7bd1d2ab553604839d183))
* implement table game base ([2d2a4a3](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2d2a4a349a9d2e0527aa0de935656536dc5f806d))
* log the reason why the connection disconnected ([1946e84](https://git3.nexdev.net/sc-packages/sc-game-base/commit/1946e84e699faf326afaba986251010f6a04fbcc))
* remove user-recheckin-consumer ([ae18f1f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/ae18f1f192592241608c162645593f0cabc85e3b))
* return enableFreeBet when in-game ([6e92607](https://git3.nexdev.net/sc-packages/sc-game-base/commit/6e926079bbde2a8badfd10519b2aec57528e97c1))
* update publisher for table game bot ([4fca4e9](https://git3.nexdev.net/sc-packages/sc-game-base/commit/4fca4e97ae8cddca6682a21be14371a77ee0aa99))

# [1.13.0-dev-TableGameBase.12](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.11...v1.13.0-dev-TableGameBase.12) (2020-08-26)


### Bug Fixes

* export HttpRouter ([e99c2db](https://git3.nexdev.net/sc-packages/sc-game-base/commit/e99c2dbd143db43472402508dfdde6093cf7bdbb))
* remove red in tempBet  of bot ([952ed6a](https://git3.nexdev.net/sc-packages/sc-game-base/commit/952ed6abeab09797b0662e235b6efc2d3d7eb69e))

# [1.13.0-dev-TableGameBase.11](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.10...v1.13.0-dev-TableGameBase.11) (2020-08-26)


### Bug Fixes

* correct wrong import ([97cd198](https://git3.nexdev.net/sc-packages/sc-game-base/commit/97cd1982ae059d231f8c4c26da418663c19a56bc))

# [1.13.0-dev-TableGameBase.10](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.9...v1.13.0-dev-TableGameBase.10) (2020-08-26)


### Features

* add onlineusers for table game base ([4813b7f](https://git3.nexdev.net/sc-packages/sc-game-base/commit/4813b7fcb848c90c52f7bd1d2ab553604839d183))

# [1.13.0-dev-TableGameBase.9](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.8...v1.13.0-dev-TableGameBase.9) (2020-08-26)

# [1.13.0-dev-TableGameBase.8](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.7...v1.13.0-dev-TableGameBase.8) (2020-08-26)


### Bug Fixes

* remove useless update user info ([dce8308](https://git3.nexdev.net/sc-packages/sc-game-base/commit/dce83085d1ca714b734de11fa4c6a898c7cbc601))

# [1.13.0-dev-TableGameBase.7](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.6...v1.13.0-dev-TableGameBase.7) (2020-08-26)

# [1.13.0-dev-TableGameBase.6](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.5...v1.13.0-dev-TableGameBase.6) (2020-08-26)


### Bug Fixes

* return winningPlayers to client ([2b1d76e](https://git3.nexdev.net/sc-packages/sc-game-base/commit/2b1d76ea89e3f14e12b0b8439b93db41ced7afcd))

# [1.13.0-dev-TableGameBase.5](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.4...v1.13.0-dev-TableGameBase.5) (2020-08-26)


### Bug Fixes

* settle game round ([24253db](https://git3.nexdev.net/sc-packages/sc-game-base/commit/24253dbe11d52e091ae40e0161ca636cbe766f53))

# [1.13.0-dev-TableGameBase.4](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.3...v1.13.0-dev-TableGameBase.4) (2020-08-25)


### Features

* update publisher for table game bot ([4fca4e9](https://git3.nexdev.net/sc-packages/sc-game-base/commit/4fca4e97ae8cddca6682a21be14371a77ee0aa99))

# [1.13.0-dev-TableGameBase.3](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.2...v1.13.0-dev-TableGameBase.3) (2020-08-25)


### Features

* log the reason why the connection disconnected ([1946e84](https://git3.nexdev.net/sc-packages/sc-game-base/commit/1946e84e699faf326afaba986251010f6a04fbcc))

# [1.13.0-dev-TableGameBase.2](https://git3.nexdev.net/sc-packages/sc-game-base/compare/v1.13.0-dev-TableGameBase.1...v1.13.0-dev-TableGameBase.2) (2020-08-25)


### Bug Fixes

* clean up changelog ([c3e8690](https://git3.nexdev.net/sc-packages/sc-game-base/commit/c3e86903e1bc03e727d0b597c53cbfe75d3d40d4))
