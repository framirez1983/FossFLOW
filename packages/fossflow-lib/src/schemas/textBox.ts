import { z } from 'zod';
import {
  ProjectionOrientationEnum,
  TextOrientationEnum
} from 'src/types/common';
import { id, coords, constrainedStrings } from './common';

export const textBoxSchema = z.object({
  id,
  tile: coords,
  content: constrainedStrings.name,
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
