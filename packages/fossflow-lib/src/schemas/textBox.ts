import { z } from 'zod';
import {
  ProjectionOrientationEnum,
  TextOrientationEnum
} from 'src/types/common';
import { id, coords } from './common';

// Free TextBox content is diagram annotation, not a name: it legitimately
// needs more room than constrainedStrings.name (max 100).
export const textBoxContentSchema = z.string().max(500);

export const textBoxSchema = z.object({
  id,
  tile: coords,
  content: textBoxContentSchema,
  fontSize: z.number().optional(),
  orientation: z
    .union([
      z.literal(ProjectionOrientationEnum.X),
      z.literal(ProjectionOrientationEnum.Y)
    ])
    .optional(),
  textOrientation: z
    .union([
      z.literal(TextOrientationEnum.SCREEN),
      z.literal(TextOrientationEnum.FOLLOW_PLANE)
    ])
    .optional()
});
