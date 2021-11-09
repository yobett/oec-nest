import { Subject } from 'rxjs';
import { Strategy } from '../../models/str/strategy';


export interface StrategyChange {
  type: 'full' | 'add' | 'update' | 'remove';
  strategy?: Strategy;
}


export class RunningStrategiesHolder {

  strategies: Strategy[] = [];
  strategyMap: Map<number, Strategy> = new Map<number, Strategy>();
  changeSubject: Subject<StrategyChange> = new Subject<StrategyChange>();


  refresh(strategies: Strategy[]): void {
    console.log('running strategies: ' + strategies.length);
    this.strategies = strategies;
    this.strategyMap = new Map<number, Strategy>(this.strategies.map(s => [s.id, s]));
    this.changeSubject.next({type: 'full'});
  }

  add(strategy: Strategy): void {
    if (strategy.status !== 'started') {
      return;
    }
    this.strategies.push(strategy);
    this.strategyMap.set(strategy.id, strategy);
    this.changeSubject.next({type: 'add', strategy});
  }

  update(id: number, dto: any): void {
    if (dto.status !== 'started') {
      this.remove(id);
      return;
    }
    const strategy = this.strategyMap.get(id);
    if (strategy) {
      Object.assign(strategy, dto);
      this.changeSubject.next({type: 'update', strategy});
    }
  }

  removeType(type: string): void {
    const s0 = this.strategies.find(s => s.type === type);
    if (!s0) {
      return;
    }
    this.strategies = this.strategies.filter(s => s.type !== type);
    this.strategyMap = new Map<number, Strategy>(this.strategies.map(s => [s.id, s]));
    this.changeSubject.next({type: 'full'});
  }

  remove(id: number): void {
    const strategy = this.strategyMap.get(id)
    if (!strategy) {
      return;
    }
    this.strategyMap.delete(id);
    this.strategies = this.strategies.filter(s => s.id !== id);
    this.changeSubject.next({type: 'remove', strategy});
  }
}
