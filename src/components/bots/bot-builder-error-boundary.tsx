import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  onClose?: () => void;
};

type State = {
  error: Error | null;
};

/** Evita derrubar a rota /app/bots inteira se o React Flow falhar. */
export class BotBuilderErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BotBuilderErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold text-foreground">Falha ao abrir o construtor</p>
        <p className="max-w-lg text-sm text-muted-foreground">
          {this.state.error.message || "Erro desconhecido no canvas de bots."}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => this.setState({ error: null })}
          >
            Tentar de novo
          </Button>
          {this.props.onClose ? (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={this.props.onClose}
            >
              Fechar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}
