import {Component, Input} from '@angular/core';
import {get} from 'lodash';
import {AuthService} from 'src/app/services/auth.service';
import {GameService} from 'src/app/services/game.service';
import {UtilService} from 'src/app/services/util.service';
import {Clue, Game, GameStatus, Room, TeamTypes} from 'types';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  @Input() game: Game;
  @Input() room?: Room;
  @Input() selectedTab?: string = 'board-tab';
  @Input() currentClue?: Clue;

  constructor(
      private readonly authService: AuthService,
      private readonly gameService: GameService,
      private readonly utilService: UtilService,
  ) {}

  // Do not allow a player to click when:
  // 1) There is no game
  // 2) The game is over
  // 3) It's not their turn
  // 4) There isn't a clue for their turn
  get disableGameBoard(): boolean {
    return !this.game || !!this.game.completedAt || !this.myTurn ||
        !this.currentClueIsFromMyTeam;
  }

  get currentClueIsFromMyTeam(): boolean {
    if (this.currentClue) {
      return this.myTeam === this.currentClue.team;
    }
    return false;
  }

  get myTeam(): TeamTypes {
    const {currentUserId} = this.authService;
    if (get(this.game, 'redTeam.userIds').includes(currentUserId)) {
      return TeamTypes.RED;
    }
    if (get(this.game, 'blueTeam.userIds').includes(currentUserId)) {
      return TeamTypes.BLUE;
    }
    return TeamTypes.OBSERVER;
  }

  get disableEndTurn(): boolean {
    return !this.game || !!this.game.completedAt || !this.myTurn;
  }

  get myTurn(): boolean {
    const {currentUserId} = this.authService;
    return get(this.game, 'redTeam.userIds').includes(currentUserId) &&
        get(this.game, 'status') === GameStatus.REDS_TURN ||
        get(this.game, 'blueTeam.userIds').includes(currentUserId) &&
        get(this.game, 'status') === GameStatus.BLUES_TURN;
  }

  get spymaster(): boolean {
    const {currentUserId} = this.authService;
    return get(this.game, 'redTeam.spymaster') === currentUserId ||
        get(this.game, 'blueTeam.spymaster') === currentUserId;
  }

  async endCurrentTeamsTurn() {
    // If no guesses have been made, double check that they really want to end
    // the turn. Codenames rules don't allow ending a turn without making any
    // guesses, but sometimes there's a good reason
    if (this.currentClue.guessesMade.length === 0) {
      const shouldEndTurn = await this.utilService.confirm(
          'End turn?',
          'You are normally not allowed to end the turn without making a guess first, but you can if you must.',
          'End turn', 'Nevermind');

      if (!shouldEndTurn) {
        return;
      }
    }

    const updates: Partial<Game> = {};

    if (this.game.status === GameStatus.REDS_TURN) {
      updates.status = GameStatus.BLUES_TURN;
    } else {
      updates.status = GameStatus.REDS_TURN;
    }

    // set the timer if one exists
    if (this.room.timer) {
      updates.turnEnds = Date.now() + (this.room.timer * 1000);
    }

    this.gameService.updateGame(this.game.id, updates);
  }
}
