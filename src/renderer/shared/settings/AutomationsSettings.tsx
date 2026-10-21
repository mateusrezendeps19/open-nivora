import { useState } from 'react';
import { emptyRule } from '../document';
import { useI18n } from '../i18n/context';
import { id } from '../id';
import type { Action } from '../reducer';
import type {
  Board,
  Label,
  Rule,
  RuleAction,
  RuleActionType,
  Trigger,
  TriggerType,
} from '../types';
import './AutomationsSettings.css';

interface AutomationsSettingsProps {
  board: Board;
  labels: Label[];
  enabled: boolean;
  dispatch: (action: Action) => void;
}

const TRIGGER_TYPES: TriggerType[] = [
  'card-added',
  'card-moved',
  'label-added',
  'checklist-completed',
];

const ACTION_TYPES: RuleActionType[] = [
  'mark-card-done',
  'mark-card-undone',
  'move-to-list',
  'add-label',
  'remove-label',
  'set-due',
  'clear-due',
  'add-checklist-item',
  'mark-checklist-done',
];

const needsList = (type: TriggerType | RuleActionType) =>
  type === 'card-added' || type === 'card-moved' || type === 'move-to-list';
const needsLabel = (type: TriggerType | RuleActionType) =>
  type === 'label-added' || type === 'add-label' || type === 'remove-label';

/** Rules run on dispatch, so a card only reacts to changes made from here on. */
export function AutomationsSettings({
  board,
  labels,
  enabled,
  dispatch,
}: AutomationsSettingsProps) {
  const [draft, setDraft] = useState<Rule | null>(null);
  const { m } = useI18n();
  const { triggers, actions: actionLabels, caveats } = m.automations;

  function startNew() {
    setDraft(
      emptyRule(m.automations.defaultName, { type: 'card-moved', listId: board.lists[0]?.id ?? null }, [
        { type: 'mark-card-done' },
      ]),
    );
  }

  function save() {
    if (!draft) return;
    const exists = board.automations.some((rule) => rule.id === draft.id);
    dispatch(exists ? { type: 'rule/update', rule: draft } : { type: 'rule/add', rule: draft });
    setDraft(null);
  }

  const listName = (listId?: string | null) =>
    board.lists.find((list) => list.id === listId)?.title ?? m.automations.anyList;
  const labelName = (labelId?: string | null) =>
    labels.find((label) => label.id === labelId)?.name ?? m.automations.anyLabel;

  function describe(rule: Rule): string {
    const trigger =
      rule.trigger.type === 'label-added'
        ? `${triggers[rule.trigger.type]} ${labelName(rule.trigger.labelId)}`
        : rule.trigger.type === 'checklist-completed'
          ? triggers[rule.trigger.type]
          : `${triggers[rule.trigger.type]} ${listName(rule.trigger.listId)}`;

    const actions = rule.actions
      .map((action) => {
        if (needsList(action.type)) return `${actionLabels[action.type]} ${listName(action.listId)}`;
        if (needsLabel(action.type)) return `${actionLabels[action.type]} ${labelName(action.labelId)}`;
        if (action.type === 'set-due') return `${actionLabels[action.type]} ${m.automations.days(action.days ?? 0)}`;
        if (action.type === 'add-checklist-item')
          return `${actionLabels[action.type]}: ${action.text ?? ''}`;
        return actionLabels[action.type];
      })
      .join(' - ');

    return `${trigger} -> ${actions}`;
  }

  return (
    <>
      <div className="auto__master">
        <label className="auto__master-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) =>
              dispatch({ type: 'prefs/set', patch: { automationsEnabled: event.target.checked } })
            }
          />
          <span>{m.automations.run}</span>
        </label>
        <p className="settings__hint">{m.automations.hint}</p>
      </div>

      <section className="settings__section">
        <h3>
          {m.automations.rulesOf}
          <strong>{board.title}</strong>
        </h3>

        {board.automations.length === 0 && <p className="settings__hint">{m.automations.none}</p>}

        <ul className="auto__list">
          {board.automations.map((rule) => (
            <li key={rule.id} className={rule.enabled ? '' : 'auto__item--off'}>
              <label className="auto__toggle">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => dispatch({ type: 'rule/toggle', ruleId: rule.id })}
                  aria-label={m.automations.enable(rule.name)}
                />
              </label>
              <div className="auto__info">
                <strong>{rule.name}</strong>
                <span>{describe(rule)}</span>
              </div>
              <button type="button" className="btn btn--subtle" onClick={() => setDraft(rule)}>
                {m.common.edit}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => dispatch({ type: 'rule/remove', ruleId: rule.id })}
              >
                {m.common.delete}
              </button>
            </li>
          ))}
        </ul>

        {!draft && (
          <button type="button" className="btn btn--primary" onClick={startNew}>
            {m.automations.newRule}
          </button>
        )}
      </section>

      {draft && (
        <section className="settings__section auto__editor">
          <h3>
            {board.automations.some((rule) => rule.id === draft.id) ? m.automations.editRule
              : m.automations.newRuleTitle}
          </h3>

          <label className="auto__field">
            <span>{m.automations.name}</span>
            <input
              className="field"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>

          <fieldset className="auto__fieldset">
            <legend>{m.automations.when}</legend>
            <div className="auto__row">
              <select
                className="field"
                value={draft.trigger.type}
                onChange={(event) => {
                  const type = event.target.value as TriggerType;
                  const trigger: Trigger = {
                    type,
                    listId: needsList(type) ? (board.lists[0]?.id ?? null) : null,
                    labelId: needsLabel(type) ? (labels[0]?.id ?? null) : null,
                  };
                  setDraft({ ...draft, trigger });
                }}
              >
                {TRIGGER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {triggers[type]}
                  </option>
                ))}
              </select>

              {needsList(draft.trigger.type) && (
                <select
                  className="field"
                  value={draft.trigger.listId ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      trigger: { ...draft.trigger, listId: event.target.value || null },
                    })
                  }
                >
                  <option value="">{m.automations.anyList}</option>
                  {board.lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.title}
                    </option>
                  ))}
                </select>
              )}

              {needsLabel(draft.trigger.type) && (
                <select
                  className="field"
                  value={draft.trigger.labelId ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      trigger: { ...draft.trigger, labelId: event.target.value || null },
                    })
                  }
                >
                  <option value="">{m.automations.anyLabel}</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </fieldset>

          <fieldset className="auto__fieldset">
            <legend>{m.automations.then}</legend>
            {draft.actions.map((action, index) => (
              <div key={index}>
                <div className="auto__row">
                  <select
                    className="field"
                    value={action.type}
                    onChange={(event) => {
                      const type = event.target.value as RuleActionType;
                      const next: RuleAction = { type };
                      if (needsList(type)) next.listId = board.lists[0]?.id;
                      if (needsLabel(type)) next.labelId = labels[0]?.id;
                      if (type === 'set-due') next.days = 1;
                      if (type === 'add-checklist-item') next.text = '';
                      setDraft({
                        ...draft,
                        actions: draft.actions.map((a, i) => (i === index ? next : a)),
                      });
                    }}
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {actionLabels[type]}
                      </option>
                    ))}
                  </select>

                  {needsList(action.type) && (
                    <select
                      className="field"
                      value={action.listId ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.map((a, i) =>
                            i === index ? { ...a, listId: event.target.value } : a,
                          ),
                        })
                      }
                    >
                      {board.lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {needsLabel(action.type) && (
                    <select
                      className="field"
                      value={action.labelId ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.map((a, i) =>
                            i === index ? { ...a, labelId: event.target.value } : a,
                          ),
                        })
                      }
                    >
                      {labels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {action.type === 'set-due' && (
                    <input
                      className="field auto__days"
                      type="number"
                      value={action.days ?? 0}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.map((a, i) =>
                            i === index ? { ...a, days: Number(event.target.value) } : a,
                          ),
                        })
                      }
                    />
                  )}

                  {action.type === 'add-checklist-item' && (
                    <input
                      className="field"
                      value={action.text ?? ''}
                      placeholder={m.automations.itemText}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.map((a, i) =>
                            i === index ? { ...a, text: event.target.value } : a,
                          ),
                        })
                      }
                    />
                  )}

                  {draft.actions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--subtle"
                      aria-label={m.automations.removeAction}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.filter((_, i) => i !== index),
                        })
                      }
                    >
                      x
                    </button>
                  )}
                </div>

                {caveats[action.type] && (
                  <p className="auto__caveat">{caveats[action.type]}</p>
                )}
              </div>
            ))}

            <button
              type="button"
              className="btn btn--subtle"
              onClick={() =>
                setDraft({ ...draft, actions: [...draft.actions, { type: 'mark-card-done' }] })
              }
            >
              {m.automations.addAction}
            </button>
          </fieldset>

          <div className="auto__editor-actions">
            <button type="button" className="btn btn--primary" onClick={save}>
              {m.automations.saveRule}
            </button>
            <button type="button" className="btn btn--subtle" onClick={() => setDraft(null)}>
              {m.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn--subtle"
              onClick={() => setDraft({ ...draft, id: id('rule'), name: m.automations.copyName(draft.name) })}
            >
              {m.automations.duplicate}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
