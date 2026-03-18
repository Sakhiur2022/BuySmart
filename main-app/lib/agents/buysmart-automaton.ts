type StateTransition = Record<string, string>;
type StateTable = Record<string, StateTransition>;

interface ValidationResult {
  accepted: boolean;
  path: string[];
  currentState: string;
}

export class BuySmartAutomaton {
  private states: StateTable;
  private initialState: string;
  private acceptStates: Set<string>;

  constructor() {
    this.states = {
      q0: { 'B': 'q1' },
      q1: { 'U': 'q2' },
      q2: { 'Y': 'q3' },
      q3: { 'S': 'q4' },
      q4: { 'M': 'q5' },
      q5: { 'A': 'q6' },
      q6: { 'R': 'q7' },
      q7: { 'T': 'q8' },
      q8: { 'S': 'q9', 'E': 'q10' },
      q9: { 'E': 'q10' },
      q10: { 'R': 'q11' },
      q11: { 'V': 'q12' },
      q12: { 'I': 'q13' },
      q13: { 'C': 'q14' },
      q14: { 'E': 'q15' },
      q15: {}
    };
    this.initialState = 'q0';
    this.acceptStates = new Set(['q8', 'q15']);
  }

  validate(input: string): ValidationResult {
    let currentState = this.initialState;
    const path = [this.initialState];
    const chars = input.toUpperCase().replace(/\s+/g, '').split('');

    for (const char of chars) {
      const nextState = this.states[currentState]?.[char];
      if (!nextState) return { accepted: false, path };
      currentState = nextState;
      path.push(currentState);
    }

    return {
      accepted: this.acceptStates.has(currentState),
      path,
      currentState
    };
  }
}
