/**
 * @fileoverview The task catalog: nine authored quests, three per level.
 *
 * Every step names exactly the blocks it needs (the toolbox narrows to
 * these) and carries three progressive hints - level 1 a concept metaphor,
 * level 2 pointing at the block, level 3 a near-answer. Never the answer:
 * that rule is enforced by the engine only ever exposing these three.
 *
 * These authored hints are also the Coach's grounding material - the
 * "fail calm" fallback if a live model is ever plugged in and errors out.
 */

/* eslint-disable no-unused-vars */
const ACB_TASKS = [
  // ---------------------------------------------------------------- beginner
  {
    id: 'hello-world',
    level: 'beginner',
    xp: 100,
    title: 'Say hello',
    quest: 'Teach the computer to greet the world',
    steps: [
      {
        text: 'Open the Text drawer and drag the print block onto the ' +
            'workspace. It already comes with a little text box attached.',
        blocks: ['text_print', 'text'],
        hints: [
          'Printing is how the computer talks to you - its words show up in the Output panel.',
          'Open the Text drawer on the left. The block that says "print" is the one you want.',
          'Drag the print block from the Text drawer and drop it anywhere on the dots.',
        ],
      },
      {
        text: 'Click the text box between the quotes (it says abc) and ' +
            'type: Hello, world!',
        blocks: ['text_print', 'text'],
        hints: [
          'The little box between the quote marks is where you type. Whatever you put there is exactly what the computer will say.',
          'Click the abc inside the print block - a typing cursor appears so you can replace it.',
          'Click the text box, delete abc, and type: Hello, world!',
        ],
      },
      {
        text: 'Press the green "Run my code" button, then read the ' +
            'Output panel.',
        blocks: ['text_print', 'text'],
        hints: [
          'Nothing happens until you run it - the green button brings your blocks to life.',
          'The big green button at the top right runs everything in your workspace.',
          'Click Run my code, then look at the Output tab: it should say Hello, world!',
        ],
      },
    ],
  },
  {
    id: 'count-to-five',
    level: 'beginner',
    xp: 100,
    title: 'Count to five',
    quest: 'Make the computer count out loud',
    steps: [
      {
        text: 'Make a variable called count and set it to 1.',
        blocks: ['variables_set', 'math_number'],
        hints: [
          'To count, the computer has to remember which number it is on. A variable stores that number so the loop can read it and raise it each time.',
          'In the Variables drawer, first press "Create variable…" and name it count - then the set block appears.',
          'Drag the set block in - it shows whatever name you created, like "set count to" - and attach a number block with 1.',
        ],
      },
      {
        text: 'Add a repeat block that repeats 5 times.',
        blocks: ['controls_repeat_ext', 'math_number', 'variables_set'],
        hints: [
          'You need the same action five times. Instead of stacking five copies, a repeat block runs whatever is inside it that many times.',
          'The Loops drawer has "repeat _ times". Put it under your set block.',
          'Drag "repeat 10 times" in and change the 10 to a 5.',
        ],
      },
      {
        text: 'Inside the repeat: print count, then change count by 1.',
        blocks: ['controls_repeat_ext', 'text_print', 'variables_get',
                 'math_change', 'math_number'],
        hints: [
          'Each trip around the loop should say the number, then count one higher.',
          'Put a print block with your variable inside the repeat, then a "change … by 1" block under it - still inside.',
          'Inside the repeat: print your variable, then change it by 1. Run it - the output should read 1 2 3 4 5.',
        ],
      },
    ],
  },
  {
    id: 'greeting-machine',
    level: 'beginner',
    xp: 100,
    title: 'Greeting machine',
    quest: 'Build a machine that greets a friend by name',
    steps: [
      {
        text: 'Make a variable called name and set it to a friend’s name.',
        blocks: ['variables_set', 'text'],
        hints: [
          'Storing the name in a variable means you type it once, and every part of the program that uses it stays in sync if it changes.',
          'In Variables, press "Create variable…" and call it name - then drag the "set name to" block in.',
          'Snap a text block into your set block and type a real name inside, like Alex.',
        ],
      },
      {
        text: 'Join "Hello, " and the name variable into one message.',
        blocks: ['text_join', 'text', 'variables_get', 'variables_set'],
        hints: [
          'Your message has a fixed part ("Hello, ") and a changing part (the name). Joining builds the full sentence out of both when the program runs.',
          'The Text drawer has a "create text with" block that joins pieces.',
          'Use create-text-with: first piece a text block "Hello, ", second your variable.',
        ],
      },
      {
        text: 'Print the joined message and run it.',
        blocks: ['text_print', 'text_join', 'text', 'variables_get'],
        hints: [
          'The machine works when the Output says hello to your friend.',
          'Snap the join block into a print block.',
          'print (create text with "Hello, " + name), then Run. Output: Hello, Alex.',
        ],
      },
    ],
  },
  // ------------------------------------------------------------ intermediate
  {
    id: 'times-table',
    level: 'intermediate',
    xp: 150,
    title: 'Times table',
    quest: 'Print the 3 times table, one line each',
    steps: [
      {
        text: 'Set a variable n to 1, and add a repeat block for 10 times.',
        blocks: ['variables_set', 'math_number', 'controls_repeat_ext'],
        hints: [
          'n will walk from 1 to 10; the loop does the walking.',
          'Create a variable n (Variables → "Create variable…"), set it to 1 above the loop, then add repeat 10 times.',
          'Set your variable to 1, then "repeat 10 times" underneath it.',
        ],
      },
      {
        text: 'Inside the loop, print n × 3.',
        blocks: ['controls_repeat_ext', 'text_print', 'math_arithmetic',
                 'variables_get', 'math_number'],
        hints: [
          'Each line of a times table is just the counter multiplied by 3.',
          'The Math drawer has an arithmetic block - set its middle to ×.',
          'Inside the loop: print (your variable × 3).',
        ],
      },
      {
        text: 'Still inside the loop, change n by 1, then run it.',
        blocks: ['controls_repeat_ext', 'math_change', 'math_number',
                 'text_print', 'math_arithmetic', 'variables_get'],
        hints: [
          'Without moving n forward, the table would print the same line ten times.',
          'A "change … by 1" block goes after the print, inside the loop.',
          'Add a change-by-1 block under the print. Run: 3, 6, 9 … 30.',
        ],
      },
    ],
  },
  {
    id: 'even-or-odd',
    level: 'intermediate',
    xp: 150,
    title: 'Even or odd',
    quest: 'Sort numbers 1–10 into even and odd',
    steps: [
      {
        text: 'Set n to 1 and repeat 10 times.',
        blocks: ['variables_set', 'math_number', 'controls_repeat_ext'],
        hints: [
          'Same walking trick as before: a counter plus a loop.',
          'Create a variable n first (Variables → "Create variable…"), set it to 1, then a repeat 10 times block under it.',
          'Set your variable to 1, then "repeat 10 times".',
        ],
      },
      {
        text: 'Inside, use an if-else: when n is even print "n is even", otherwise print "n is odd".',
        blocks: ['controls_if', 'math_number_property', 'text_print',
                 'text_join', 'variables_get', 'text', 'controls_repeat_ext'],
        hints: [
          'Each number needs a different sentence depending on a test. That is what if/else is for: one branch runs when the test is true, the other when it is not.',
          'Math has an "is even" test block; Logic has if/else (click the gear to add else).',
          'if (your variable is even) print it joined with " is even", else joined with " is odd".',
        ],
      },
      {
        text: 'Change n by 1 at the bottom of the loop and run it.',
        blocks: ['math_change', 'math_number', 'controls_if',
                 'controls_repeat_ext', 'text_print'],
        hints: [
          'The counter has to move or the loop tests 1 forever.',
          'A change-by-1 block goes last inside the loop.',
          'Run it: lines alternate odd, even, odd, even … up to 10.',
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- advanced
  {
    id: 'countdown',
    level: 'advanced',
    xp: 200,
    title: 'Rocket countdown',
    quest: 'Count down from 10 and lift off',
    steps: [
      {
        text: 'Create a variable called fuel. Set fuel to 10, then ' +
            'repeat 10 times.',
        blocks: ['variables_set', 'math_number', 'controls_repeat_ext'],
        hints: [
          'Countdowns start full and drain to zero.',
          'Create a variable fuel (Variables → "Create variable…"), set it to 10, then a repeat 10 times block.',
          'Set your variable to 10, then "repeat 10 times".',
        ],
      },
      {
        text: 'Inside the loop: print fuel, then change fuel so the ' +
            'count goes DOWN each time round.',
        blocks: ['controls_repeat_ext', 'text_print', 'variables_get',
                 'math_change', 'math_number'],
        hints: [
          'Say the number, then burn one unit of fuel.',
          'Print your variable, then a change-by block - but type -1 as its number.',
          'Print the variable, then change it by -1. Both inside the loop.',
        ],
      },
      {
        text: 'After the loop (not inside), print "Lift off!" and run it.',
        blocks: ['text_print', 'text', 'controls_repeat_ext', 'math_change'],
        hints: [
          'The launch happens once, after all the counting is done.',
          'Snap the final print under the repeat block, not into it.',
          'Below the loop: print "Lift off!". Run: 10 9 8 … 1 Lift off!',
        ],
      },
    ],
  },
  {
    id: 'fizzbuzz',
    level: 'advanced',
    xp: 200,
    title: 'FizzBuzz',
    quest: 'The classic: multiples of 3 say Fizz, of 5 say Buzz',
    steps: [
      {
        text: 'Set n to 1 and repeat 15 times.',
        blocks: ['variables_set', 'math_number', 'controls_repeat_ext'],
        hints: [
          'Fifteen numbers is enough to meet a Fizz, a Buzz, and a FizzBuzz.',
          'Counter n starts at 1; loop 15 times.',
          '"set n to 1", then "repeat 15 times".',
        ],
      },
      {
        text: 'Inside, build the test chain: divisible by 15 → "FizzBuzz", by 3 → "Fizz", by 5 → "Buzz", otherwise print n. (Click the if block’s gear to add else-if arms.)',
        blocks: ['controls_if', 'math_number_property', 'math_number',
                 'text_print', 'text', 'variables_get', 'controls_repeat_ext'],
        hints: [
          'Test the most specific rule first - 15 before 3 and 5 - or FizzBuzz never gets a turn.',
          'The if block’s gear icon lets you add else-if and else arms; "is divisible by" lives in Math.',
          'if n divisible by 15: print FizzBuzz; else if by 3: Fizz; else if by 5: Buzz; else: print n.',
        ],
      },
      {
        text: 'Change n by 1 at the loop’s end and run it.',
        blocks: ['math_change', 'math_number', 'controls_if',
                 'controls_repeat_ext'],
        hints: [
          'One step forward per loop, as always.',
          '"change n by 1", inside the loop, after the if chain.',
          'Run: 1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz.',
        ],
      },
    ],
  },
  {
    id: 'sum-to-hundred',
    level: 'advanced',
    xp: 200,
    title: 'The 1-to-100 sum',
    quest: 'Add every number from 1 to 100 - the young Gauss trick, by loop',
    steps: [
      {
        text: 'Set total to 0 and n to 1.',
        blocks: ['variables_set', 'math_number'],
        hints: [
          'You need two memories: total holds the sum collected so far, and n tracks which number gets added next.',
          'Create two variables (Variables → "Create variable…"): total set to 0, n set to 1.',
          '"set total to 0" and "set n to 1", stacked.',
        ],
      },
      {
        text: 'Repeat 100 times: change total by n, then change n by 1.',
        blocks: ['controls_repeat_ext', 'math_number', 'math_change',
                 'variables_get'],
        hints: [
          'Every trip: pour the counter into the total, then step the counter.',
          'Two change blocks inside the loop: total grows by n, n grows by 1.',
          'repeat 100: change total by n; change n by 1.',
        ],
      },
      {
        text: 'After the loop, print total and run it.',
        blocks: ['text_print', 'variables_get', 'controls_repeat_ext'],
        hints: [
          'One famous number should appear.',
          'Print the total variable below the loop.',
          'print total → 5050. Gauss did it in his head; you built a machine.',
        ],
      },
    ],
  },
  {
    id: 'fibonacci',
    level: 'advanced',
    xp: 200,
    title: 'Fibonacci',
    quest: 'Print the first 10 Fibonacci numbers',
    steps: [
      {
        text: 'Set a to 0 and b to 1.',
        blocks: ['variables_set', 'math_number'],
        hints: [
          'Every Fibonacci number is the sum of the two before it, so the program only ever needs to remember two values - that is what a and b are for.',
          'Create variables a and b (Variables → "Create variable…"), then two set blocks: a to 0, b to 1.',
          '"set a to 0", "set b to 1".',
        ],
      },
      {
        text: 'Repeat 10 times: print a, then set temp to a + b, set a to b, set b to temp.',
        blocks: ['controls_repeat_ext', 'math_number', 'text_print',
                 'variables_get', 'variables_set', 'math_arithmetic'],
        hints: [
          'Say the smaller seed, then shuffle: the pair slides one step along the sequence.',
          'You need a third box, temp, so no value gets lost mid-shuffle.',
          'Inside the loop: print a; set temp to a+b; set a to b; set b to temp.',
        ],
      },
      {
        text: 'Run it and check the sequence.',
        blocks: ['controls_repeat_ext', 'text_print', 'variables_set'],
        hints: [
          'Each number should be the sum of the two before it.',
          'Expected output starts 0 1 1 2 3 5 …',
          'Run: 0 1 1 2 3 5 8 13 21 34. If a number repeats, check the shuffle order.',
        ],
      },
    ],
  },
];

/**
 * Friendly explanations for "What does this block do?" - the Coach's local
 * knowledge. Static per block type, so no live call is ever needed for it.
 */
const ACB_BLOCK_EXPLANATIONS = {
  'text_print': 'The print block displays a value in the Output panel. It is how a program shows its result to you. Whatever is attached in its slot, text, a number, or a variable, is written to the Output when the program runs.',
  'text': 'A text block holds a piece of written text, called a string. Click between the quotation marks to type. Programs use text blocks for anything meant to be read by a person, such as messages or names.',
  'text_join': 'The create-text-with block combines several pieces of text into one. It is useful when part of a message is fixed and part changes, for example joining "Hello, " with whatever name a variable holds.',
  'controls_repeat_ext': 'The repeat block runs the blocks placed inside it a set number of times. Instead of stacking the same blocks again and again, you place them once inside repeat and choose how many times they should run.',
  'controls_whileUntil': 'This loop repeats the blocks inside it for as long as its condition stays true (or, in until mode, keeps going until the condition becomes true). Use it when you do not know in advance how many repetitions are needed.',
  'controls_if': 'The if block makes a decision. It checks its condition first; when the condition is true, the blocks inside run, and when it is false, they are skipped. The gear icon lets you add an else-if branch, which tests another condition, and an else branch, which runs when no condition was true.',
  'logic_compare': 'The compare block examines two values, for example checking whether they are equal or whether one is larger. Its answer is either true or false, which is exactly what an if block or a loop needs for its condition.',
  'logic_operation': 'The and/or block combines two true-or-false tests into one. With "and", both tests must be true; with "or", one being true is enough.',
  'math_number': 'A number block holds one number. Click it to change the value. Attach it wherever a block expects a numeric input, such as repeat counts or arithmetic.',
  'math_arithmetic': 'The arithmetic block performs one calculation, addition, subtraction, multiplication, or division, on the two values attached to it, and hands over the result.',
  'math_change': 'The change-by block adds an amount to a variable and stores the result back in the same variable. It is the standard way to move a counter forward inside a loop.',
  'math_number_property': 'This block tests a property of a number, such as whether it is even, odd, or divisible by another number. Its answer is true or false, so it fits directly into an if block.',
  'variables_set': 'The set block stores a value in a variable, which is a named place the program remembers. After setting it, any block that uses the variable receives that stored value.',
  'variables_get': 'This block hands over whatever value its variable currently holds. Wherever you attach it, the program behaves as if the stored value were written there.',
  'procedures_defnoreturn': 'A function block groups several steps under one name. Define the steps once, and the program can perform all of them wherever the function is called.',
  'procedures_callnoreturn': 'This block runs a function you defined, performing all of the steps grouped inside it, exactly as if they were written at this spot.',
};

/**
 * Second-pass explanations: a concrete everyday framing for each block,
 * used by "Explain another way" when the AI is offline.
 */
const ACB_BLOCK_EXPLANATIONS_SIMPLE = {
  'text_print': 'Think of print as the program speaking. Run the program and look at the Output panel: every print block writes one thing there, in order.',
  'text': 'This is simply a place to type words. For example, type your name in it, attach it to a print block, and the program will display your name.',
  'text_join': 'Like building one sentence from parts: "Hello, " plus a name makes "Hello, Alex". The join block glues the parts together when the program runs.',
  'controls_repeat_ext': 'Imagine telling someone: clap five times. You would not say clap, clap, clap, clap, clap. The repeat block is that shortcut: put clap inside once and set the number to five.',
  'controls_whileUntil': 'Like stirring a pot while it is still lumpy: you do not count the stirs in advance, you keep going while the condition holds.',
  'controls_if': 'Like a rule in daily life: IF it is raining, take an umbrella. The condition is checked first, and the action happens only when the condition is true. Else covers what to do otherwise.',
  'logic_compare': 'It asks one question about two values, such as: is 7 bigger than 5? The answer is always just true or false.',
  'logic_operation': 'Two conditions joined together: "hungry AND food ready" needs both; "tea OR coffee" is satisfied by either one.',
  'math_number': 'Just a number you choose, like the 5 in repeat 5 times. Click it and type a different number to change the program.',
  'math_arithmetic': 'A small calculator with one operation: give it 3 and 4 with a plus sign and it hands back 7.',
  'math_change': 'Like adding to a score: change score by 1 means the score goes up by one each time this block runs.',
  'math_number_property': 'It checks one fact about a number, for example: is 6 even? Yes, so the answer is true.',
  'variables_set': 'A variable is like a labelled jar. Set puts something in the jar; the label lets you find it again later.',
  'variables_get': 'This opens the labelled jar and uses whatever is inside right now.',
  'procedures_defnoreturn': 'Like naming a recipe: define the steps for making tea once, and after that "make tea" means all of those steps.',
  'procedures_callnoreturn': 'This says: do the recipe now. All the steps you grouped under that name run here.',
};

/**
 * Auto-magic checks, one per step (27 total), keyed by task id. Merged onto
 * ACB_TASKS at load. Kept separate so the quest text above stays readable.
 *
 * Philosophy: recognise the *shape* of success, not one exact program.
 * Variable names are never checked; numbers only when the step names them.
 */
const ACB_TASK_CHECKS = {
  'hello-world': [
    {blocks: [{type: 'text_print'}]},
    {within: [{child: 'text', of: 'text_print'}],
     fields: [{type: 'text', name: 'TEXT', includes: 'hello'},
              {type: 'text', name: 'TEXT', includes: 'world'}]},
    {output: {includes: ['hello', 'world']}},
  ],
  'count-to-five': [
    {blocks: [{type: 'variables_set'}, {type: 'math_number'}]},
    {blocks: [{type: 'controls_repeat_ext'}],
     within: [{child: 'math_number', of: 'controls_repeat_ext'}],
     fields: [{type: 'math_number', name: 'NUM', equals: '5'}]},
    {within: [{child: 'text_print', of: 'controls_repeat_ext'},
              {child: 'math_change', of: 'controls_repeat_ext'}],
     output: {includes: ['1', '5']}},
  ],
  'greeting-machine': [
    {blocks: [{type: 'variables_set'}, {type: 'text'}]},
    {blocks: [{type: 'text_join'}],
     within: [{child: 'variables_get', of: 'text_join'}]},
    {within: [{child: 'text_join', of: 'text_print'}],
     output: {includes: 'hello'}},
  ],
  'times-table': [
    {blocks: [{type: 'variables_set'}, {type: 'controls_repeat_ext'}],
     fields: [{type: 'math_number', name: 'NUM', equals: '10'}]},
    {within: [{child: 'text_print', of: 'controls_repeat_ext'},
              {child: 'math_arithmetic', of: 'text_print'}]},
    {within: [{child: 'math_change', of: 'controls_repeat_ext'}],
     output: {includes: ['3', '30']}},
  ],
  'even-or-odd': [
    {blocks: [{type: 'variables_set'}, {type: 'controls_repeat_ext'}]},
    {blocks: [{type: 'math_number_property'}],
     within: [{child: 'controls_if', of: 'controls_repeat_ext'}]},
    {within: [{child: 'math_change', of: 'controls_repeat_ext'}],
     output: {includes: ['even', 'odd']}},
  ],
  'countdown': [
    {blocks: [{type: 'variables_set'}, {type: 'controls_repeat_ext'}],
     fields: [{type: 'math_number', name: 'NUM', equals: '10'}]},
    // The -1 matters: a change block dragged in still reading its
    // default 1 counts UP, so the step must not pass until it is -1.
    {within: [{child: 'text_print', of: 'controls_repeat_ext'},
              {child: 'math_change', of: 'controls_repeat_ext'}],
     fields: [{type: 'math_number', name: 'NUM', equals: '-1'}]},
    {blocks: [{type: 'text_print', count: 2}],
     output: {includes: ['10', '1', 'lift off']}},
  ],
  'fizzbuzz': [
    {blocks: [{type: 'variables_set'}, {type: 'controls_repeat_ext'}],
     fields: [{type: 'math_number', name: 'NUM', equals: '15'}]},
    {blocks: [{type: 'math_number_property'}],
     within: [{child: 'controls_if', of: 'controls_repeat_ext'}]},
    {within: [{child: 'math_change', of: 'controls_repeat_ext'}],
     output: {includes: ['Fizz', 'Buzz', 'FizzBuzz']}},
  ],
  'sum-to-hundred': [
    {blocks: [{type: 'variables_set', count: 2}, {type: 'math_number'}]},
    {blocks: [{type: 'controls_repeat_ext'}, {type: 'math_change', count: 2}],
     within: [{child: 'math_change', of: 'controls_repeat_ext', count: 2}]},
    {blocks: [{type: 'text_print'}],
     output: {includes: '5050'}},
  ],
  'fibonacci': [
    {blocks: [{type: 'variables_set', count: 2}]},
    {within: [{child: 'text_print', of: 'controls_repeat_ext'},
              {child: 'variables_set', of: 'controls_repeat_ext', count: 3}],
     blocks: [{type: 'math_arithmetic'}]},
    {output: {includes: ['0', '1', '2', '3', '5', '8', '13', '21', '34']}},
  ],
};

// Merge the checks onto the task definitions.
for (const task of ACB_TASKS) {
  const checks = ACB_TASK_CHECKS[task.id];
  if (!checks || checks.length !== task.steps.length) {
    console.error(`Task ${task.id}: expected ${task.steps.length} checks, ` +
        `got ${checks ? checks.length : 0}`);
    continue;
  }
  task.steps.forEach((step, i) => { step.check = checks[i]; });
}


/* ------------------------------------------------------------------------ */
/* Parsons quests: the whole program is given, scrambled; assembling it is   */
/* the puzzle. The toolbox goes empty - zero block-hunting, pure structure.  */
/* ------------------------------------------------------------------------ */

ACB_TASKS.push({
    id: 'untangle-hello',
    title: '🧩 Untangle: say hi 3 times',
    level: 'beginner',
    xp: 100,
    steps: [{
        text: 'All the blocks you need are already on the canvas, just ' +
            'scrambled. Snap them into one stack that says hi three times, ' +
            'then press Run.',
        blocks: ['controls_repeat_ext', 'text_print'],
        parsons: [
            {type: 'controls_repeat_ext', inputs: {TIMES: {block:
                {type: 'math_number', fields: {NUM: 3}}}}},
            {type: 'text_print', inputs: {TEXT: {block:
                {type: 'text', fields: {TEXT: 'hi'}}}}},
        ],
        check: {
            within: [{child: 'text_print', of: 'controls_repeat_ext'}],
            singleStack: true,
            output: {includes: ['hi']},
        },
        hints: [
            'Every piece is already here. One block is a container: which ' +
                'block is meant to hold another block inside it?',
            'The print block belongs inside the repeat block. Drag the ' +
                'print block into the repeat block\'s opening.',
            'Put the print block inside the repeat block so it reads ' +
                '"repeat 3 times, print hi". Then press Run: hi appears ' +
                'three times.',
        ],
    }],
});

ACB_TASKS.push({
    id: 'untangle-count',
    title: '🧩 Untangle: count by twos',
    level: 'intermediate',
    xp: 150,
    steps: [{
        text: 'The pieces of a counting program are scattered on the ' +
            'canvas. Arrange them into one stack that prints 2, 4, 6.',
        blocks: ['variables_set', 'controls_repeat_ext', 'math_change',
            'text_print'],
        parsons: [
            {type: 'variables_set', fields: {VAR: {name: 'count'}},
                inputs: {VALUE: {block:
                    {type: 'math_number', fields: {NUM: 0}}}}},
            {type: 'controls_repeat_ext', inputs: {TIMES: {block:
                {type: 'math_number', fields: {NUM: 3}}}}},
            {type: 'math_change', fields: {VAR: {name: 'count'}},
                inputs: {DELTA: {block:
                    {type: 'math_number', fields: {NUM: 2}}}}},
            {type: 'text_print', inputs: {TEXT: {block:
                {type: 'variables_get', fields: {VAR: {name: 'count'}}}}}},
        ],
        check: {
            singleStack: true,
            within: [
                {child: 'math_change', of: 'controls_repeat_ext'},
                {child: 'text_print', of: 'controls_repeat_ext'},
            ],
            output: {includes: ['2', '4', '6']},
        },
        hints: [
            'Read the goal again: start at 0, grow by 2 each round. Which ' +
                'block has to run first, before any repeating?',
            'Order matters: the set block comes first, then the repeat ' +
                'block. The change block and the print block go inside ' +
                'the repeat.',
            'Build: set count to 0, then repeat 3 times holding change ' +
                'count by 2 followed by print count. Run shows 2, 4, 6.',
        ],
    }],
});
