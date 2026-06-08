import { Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../shared/errors';
import { QueryService } from './query.service';

const askSchema = z.object({
  question: z.string().min(3, 'question is required'),
});

export class QueryController {
  constructor(private readonly service: QueryService) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid request body', parsed.error.flatten().fieldErrors);
    }
    const result = await this.service.ask(parsed.data.question);
    res.json(result);
  };
}
