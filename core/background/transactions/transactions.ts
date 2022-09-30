import type { BadgeControl } from 'background/notifications';
import type { NetworkControl } from 'core/background/network';

import { AccountController, NIL_ACCOUNT } from 'core/background/account';
import { Fields } from 'config/fields';
import { TransactionsError } from './errors';
import { MAX_TX_QUEUE } from 'config/common';
import { BrowserStorage, buildObject } from 'lib/storage';
import type { TransactionParam } from 'types/transaction';


export class TransactionsController {
  readonly #network: NetworkControl;
  readonly #account: AccountController;
  readonly #badge: BadgeControl;

  #history: object[] = [];
  #confirm: TransactionParam[] = [];
  #message?: object;

  get history() {
    return this.#history;
  }

  get confirm() {
    return this.#confirm;
  }

  get message() {
    return this.#message;
  }

  get #historyField() {
    if (this.#account.selectedAccount) {
      return `${Fields.TRANSACTIONS}/${this.#network.selected}/${this.#account.selectedAccount.base58}`;
    }

    throw new TransactionsError(NIL_ACCOUNT);
  }

  get #confirmField() {
    return `${Fields.CONFIRM_TRANSACTIONS}/${this.#network.selected}`;
  }

  constructor(
    network: NetworkControl,
    account: AccountController,
    badge: BadgeControl
  ) {
    this.#network = network;
    this.#account = account;
    this.#badge = badge;
  }

  async addHistory(tx: object) {
    const newList = [tx, ...this.history];

    // Circumcision Array.
    newList.length = MAX_TX_QUEUE;

    this.#history = newList.filter(Boolean);

    await BrowserStorage.set(
      buildObject(this.#historyField, this.history)
    );
  }

  async updateHistory(history: object[]) {
    this.#history = history;
    await BrowserStorage.set(
      buildObject(this.#historyField, this.history)
    );
  }

  async clearHistory() {
    this.#history = [];
    await BrowserStorage.set(
      buildObject(this.#historyField, this.history)
    );
  }

  async clearConfirm() {
    this.#badge.decrease(this.confirm.length);
    this.#confirm = [];

    await BrowserStorage.set(
      buildObject(this.#confirmField, this.confirm)
    );
  }

  async addConfirm(params: TransactionParam) {
    this.#confirm.push(params);
    this.#badge.increase();
    await BrowserStorage.set(
      buildObject(this.#confirmField, this.confirm)
    );
  }

  async addMessage(message: object) {
    this.#message = message;
    this.#badge.increase();
    await BrowserStorage.set(
      buildObject(Fields.CONFIRM_SIGN_MESSAGE, message)
    );
  }

  async removeMessage() {
    this.#message = undefined;
    this.#badge.decrease();
    await BrowserStorage.rm(Fields.CONFIRM_SIGN_MESSAGE);
  }

  async rmConfirm(index: number) {
    delete this.#confirm[index];

    this.#confirm = this.#confirm.filter(Boolean);
    this.#badge.decrease();

    await BrowserStorage.set(
      buildObject(this.#confirmField, this.confirm)
    );
  }

  async resetNonce(nonce: number) {
    this.#history = this.history.map((t) => ({
      ...t,
      nonce
    }));

    await BrowserStorage.set(
      buildObject(this.#historyField, this.#history)
    );
  }

  async sync() {
    try {
      const confirmJson = await BrowserStorage.get(this.#confirmField);
      if (confirmJson) {
        this.#confirm = JSON.parse(String(confirmJson));
      }
    } catch (err) {
      this.#confirm = [];
    }

    try {
      const txnsJson = await BrowserStorage.get(this.#historyField);
      if (!txnsJson) {
        throw new Error();
      }
      this.#history = JSON.parse(String(txnsJson));
    } catch (err) {
      this.#history = [];
    }

    await this.#badge.setCounter(this.#confirm.length);
  }

}
