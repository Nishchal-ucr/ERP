"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  ChevronRightIcon,
} from "lucide-react";

import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item";

interface ReportItemProps {
  title: string;
  href: string;
  completed: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  className?: string;
}

export function ReportItem({
  title,
  href,
  completed,
  onClick,
  className,
}: ReportItemProps) {
  return (
    <Item variant="outline" size="default" asChild className={className}>
      <Link href={href} onClick={onClick}>
        <ItemMedia>
          {completed ? (
            <CircleCheckIcon className="size-6 text-green-600" />
          ) : (
            <CircleDashedIcon className="size-6 text-muted-foreground" />
          )}
        </ItemMedia>

        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
        </ItemContent>

        <ItemActions>
          <ChevronRightIcon className="size-4" />
        </ItemActions>
      </Link>
    </Item>
  );
}
