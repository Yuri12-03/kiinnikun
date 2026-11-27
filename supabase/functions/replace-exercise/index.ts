import { createReplacementHandler } from './handler.ts';

Deno.serve(createReplacementHandler({ env: (name) => Deno.env.get(name), fetch }));
