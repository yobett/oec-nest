import { Strategy } from '../../models/str/strategy';

export class RunningStrategiesHolder {

  strategies: Strategy[] = [];
  strategyMap: Map<number, Strategy> = new Map<number, Strategy>();


  refresh(strategies: Strategy[]): void {
    console.log('running strategies: ' + strategies.length);
    this.strategies = strategies;
    this.strategyMap = new Map<number, Strategy>(this.strategies.map(s => [s.id, s]));
  }

  add(strategy: Strategy): void {
    if (strategy.status !== 'started') {
      return;
    }
    this.strategies.push(strategy);
    this.strategyMap.set(strategy.id, strategy);
  }

  update(id: number, dto: any): void {
    if (dto.status !== 'started') {
      this.remove(id);
      return;
    }
    const strategy = this.strategyMap.get(id);
    if (strategy) {
      Object.assign(strategy, dto);
    }
  }

  removeType(type: string): void {
    const strategies = this.strategies.filter(s => s.type !== type);
    this.refresh(strategies);
  }

  remove(id: number): void {
    if (!this.strategyMap.has(id)) {
      return;
    }
    this.strategyMap.delete(id);
    this.strategies = this.strategies.filter(s => s.id !== id);
  }
}
