import { ComponentProps, forwardRef, useMemo, useState } from "react";
import {
  CheckCircleIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

interface Props
  extends Omit<ComponentProps<"div">, "className" | "onClick" | "title"> {
  text: string;
}

const CopyButton = forwardRef<HTMLDivElement, Props>(() => {
  return <div> </div>;
});

export default CopyButton;
