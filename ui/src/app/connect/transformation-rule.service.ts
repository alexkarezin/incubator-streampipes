/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {Injectable} from '@angular/core';
import {EventSchema} from './schema-editor/model/EventSchema';
import {TransformationRuleDescription} from './model/connect/rules/TransformationRuleDescription';
import {Logger} from '../shared/logger/default-log.service';
import {RenameRuleDescription} from './model/connect/rules/RenameRuleDescription';
import {EventProperty} from './schema-editor/model/EventProperty';
import {EventPropertyPrimitive} from './schema-editor/model/EventPropertyPrimitive';
import {EventPropertyNested} from './schema-editor/model/EventPropertyNested';
import {AddNestedRuleDescription} from './model/connect/rules/AddNestedRuleDescription';
import {MoveRuleDescription} from './model/connect/rules/MoveRuleDesctiption';
import {DeleteRuleDescription} from './model/connect/rules/DeleteRuleDescription';
import {UnitTransformRuleDescription} from './model/connect/rules/UnitTransformRuleDescription';
import {AddTimestampRuleDescription} from './model/connect/rules/AddTimestampRuleDescription';
import {AddValueTransformationRuleDescription} from './model/connect/rules/AddValueTransformationRuleDescription';
import {TimestampTransformationRuleMode} from './model/connect/rules/TimestampTransformationRuleMode';
import {TimestampTransformationRuleDescription} from './model/connect/rules/TimestampTransformationRuleDescription';

@Injectable()
export class TransformationRuleService {

    private oldEventSchema: EventSchema = null;
    private newEventSchema: EventSchema = null;

    constructor(public logger: Logger) {}

    public setOldEventSchema(oldEventSchema: EventSchema) {
        this.oldEventSchema = oldEventSchema;
    }

    public setNewEventSchema(newEventSchema: EventSchema) {
        this.newEventSchema = newEventSchema;
    }

    public getTransformationRuleDescriptions(): TransformationRuleDescription[] {
        var transformationRuleDescription: TransformationRuleDescription[] = [];

        if (this.oldEventSchema == null || this.newEventSchema == null) {
            this.logger.error("Old and new schema must be defined")
        } else {

            let addedTimestampProperties = this.getTimestampProperty(this.newEventSchema.eventProperties);
            if (addedTimestampProperties) {
                // add to old event schema for the case users moved the property to a nested property
                this.oldEventSchema.eventProperties.push(addedTimestampProperties);

                transformationRuleDescription.push(new AddTimestampRuleDescription(addedTimestampProperties.getRuntimeName()));
            }

            let staticValueProperties = this.getStaticValueProperties(this.newEventSchema.eventProperties);
            for (let ep of staticValueProperties) {
                this.oldEventSchema.eventProperties.push(ep);
                transformationRuleDescription.push(new AddValueTransformationRuleDescription(ep.getRuntimeName(), (<EventPropertyPrimitive> ep).staticValue))
            }

            // Rename
            transformationRuleDescription = transformationRuleDescription.concat(this.getRenameRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));


            // Create Nested
            transformationRuleDescription = transformationRuleDescription.concat(this.getCreateNestedRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));

            // Move
            transformationRuleDescription = transformationRuleDescription.concat(this.getMoveRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));

            // Delete
            transformationRuleDescription = transformationRuleDescription.concat(this.getDeleteRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));

            // Unit
            transformationRuleDescription = transformationRuleDescription.concat(this.getUnitTransformRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));

            // Timestmap
            transformationRuleDescription = transformationRuleDescription.concat(this.getTimestampTransformRules(
                this.newEventSchema.eventProperties, this.oldEventSchema, this.newEventSchema));

            return transformationRuleDescription;
        }
    }

    public getMoveRules(newEventProperties: EventProperty[],
                        oldEventSchema: EventSchema,
                        newEventSchema: EventSchema): MoveRuleDescription[] {

        var result: MoveRuleDescription[] = [];

        for (let eventProperty of newEventProperties) {

            if (eventProperty instanceof EventPropertyNested) {

                const tmpResults: MoveRuleDescription[] = this.getMoveRules((<EventPropertyNested> eventProperty).eventProperties, oldEventSchema, newEventSchema);
                result = result.concat(tmpResults);

            }
            const keyOld: string = this.getCompleteRuntimeNameKey(oldEventSchema.eventProperties, eventProperty.id);
            const keyNew: string = this.getCompleteRuntimeNameKey(newEventSchema.eventProperties, eventProperty.id);


            // get prefix
            if (keyOld && keyNew) {

                const keyOldPrefix: string = keyOld.substr(0, keyOld.lastIndexOf("."));
                const keyNewPrefix: string = keyNew.substr(0, keyNew.lastIndexOf("."));

                if (keyOldPrefix != keyNewPrefix) {

                    // old key is equals old route and new name
                    var keyOfOldValue = "";
                    if (keyOldPrefix === "") {
                        keyOfOldValue = keyNew.substr(keyNew.lastIndexOf(".") + 1, keyNew.length)
                    } else {
                        keyOfOldValue = keyOldPrefix + "." + keyNew.substr(keyNew.lastIndexOf(".") + 1, keyNew.length);
                    }
                    result.push(new MoveRuleDescription(keyOfOldValue, keyNewPrefix));
                }
            }

        }

        return result;
    }

    public getCreateNestedRules(newEventProperties: EventProperty[],
                                oldEventSchema: EventSchema,
                                newEventSchema: EventSchema): AddNestedRuleDescription[] {


        var allNewIds: string[] = this.getAllIds(newEventSchema.eventProperties);
        var allOldIds: string[] = this.getAllIds(oldEventSchema.eventProperties);

        const result: AddNestedRuleDescription[] = [];
        for (let id of allNewIds) {

            if (allOldIds.indexOf(id) === -1) {
                const key = this.getCompleteRuntimeNameKey(newEventSchema.eventProperties, id);
                result.push(new AddNestedRuleDescription(key));
            }
        }

        return result;
    }


    public getRenameRules(newEventProperties: EventProperty[],
                          oldEventSchema: EventSchema,
                          newEventSchema: EventSchema): RenameRuleDescription[] {

        var result: RenameRuleDescription[] = [];

        for (let eventProperty of newEventProperties) {
            const keyOld = this.getCompleteRuntimeNameKey(oldEventSchema.eventProperties, eventProperty.id);
            const keyNew = this.getCompleteRuntimeNameKey(newEventSchema.eventProperties, eventProperty.id);

            result.push(new RenameRuleDescription(keyOld, keyNew));
            if (eventProperty instanceof EventPropertyNested) {

                const tmpResults: RenameRuleDescription[] = this.getRenameRules((<EventPropertyNested> eventProperty).eventProperties, oldEventSchema, newEventSchema);
                result = result.concat(tmpResults);

            }
        }

        var filteredResult: RenameRuleDescription[] = [];
        for (let res of result) {
            if (this.getRuntimeNameKey(res.newRuntimeKey) != this.getRuntimeNameKey(res.oldRuntimeKey) && res.oldRuntimeKey) {
                filteredResult.push(res);
            }
        }

        return filteredResult;
    }

    public getDeleteRules(newEventProperties: EventProperty[],
                          oldEventSchema: EventSchema,
                          newEventSchema: EventSchema): DeleteRuleDescription[] {

        var resultKeys: string[] = [];

        var allNewIds: string[] = this.getAllIds(newEventSchema.eventProperties);
        var allOldIds: string[] = this.getAllIds(oldEventSchema.eventProperties);

        for (let id of allOldIds) {
            // if not in new ids create delete rule
            if (allNewIds.indexOf(id) == -1) {
                const key = this.getCompleteRuntimeNameKey(oldEventSchema.eventProperties, id);
                resultKeys.push(key);
            }
        }

        var uniqEs6 = (arrArg) => {
            return arrArg.filter((elem, pos, arr) => {
                var r = true;
                for (let a of arr) {
                    if (elem.startsWith(a) && a != elem) {
                        r = false;
                    }
                }

                return r;
            });
        };

        resultKeys = uniqEs6(resultKeys);

        var resultRules: DeleteRuleDescription[] = [];
        for (let key of resultKeys) {
            resultRules.push(new DeleteRuleDescription(key));
        }

        return resultRules;
    }

    public getUnitTransformRules(newEventProperties: EventProperty[],
                                 oldEventSchema: EventSchema,
                                 newEventSchema: EventSchema): UnitTransformRuleDescription[] {
        var result: UnitTransformRuleDescription[] = [];

        for (let eventProperty of newEventProperties) {

            if (eventProperty instanceof EventPropertyPrimitive) {
                const eventPropertyPrimitive =  eventProperty as EventPropertyPrimitive;
                const keyNew = this.getCompleteRuntimeNameKey(newEventSchema.eventProperties, eventPropertyPrimitive.id);


                result.push(new UnitTransformRuleDescription(keyNew,
                    // TODO: use if backend deserialize URI correct
                    //             eventPropertyPrimitive.oldMeasurementUnit, eventPropertyPrimitive.measurementUnit));
                    eventPropertyPrimitive.oldMeasurementUnit, eventPropertyPrimitive.measurementUnitTmp));
            } else if (eventProperty instanceof EventPropertyNested) {

                const tmpResults: UnitTransformRuleDescription[] =
                    this.getUnitTransformRules((<EventPropertyNested> eventProperty).eventProperties,  oldEventSchema, newEventSchema);
                result = result.concat(tmpResults);

            }


        }

        var filteredResult: UnitTransformRuleDescription[] = [];
        for (let res of result) {
            if (res.fromUnitRessourceURL !== res.toUnitRessourceURL) {
                filteredResult.push(res);
            }
        }

        return filteredResult;


    }


    public getCompleteRuntimeNameKey(eventProperties: EventProperty[], id: string): string {
        var result: string = '';

        for (let eventProperty of eventProperties) {

            if (eventProperty.id === id) {
                return eventProperty.getRuntimeName();
            } else {
                if (eventProperty instanceof EventPropertyNested) {
                    var methodResult = this.getCompleteRuntimeNameKey((<EventPropertyNested> eventProperty).eventProperties, id);
                    if (methodResult != null) {
                        result = eventProperty.getRuntimeName() + "." + methodResult;
                    }
                }
            }
        }

        if (result == '') {
            return null;
        } else {
            return result;
        }
    }

    public getRuntimeNameKey(completeKey: string): string {
        if (completeKey) {
            const keyElements = completeKey.split(".");

            if (keyElements.length == 0) {
                return completeKey;
            } else {
                return keyElements[keyElements.length - 1];
            }
        }

    }


    public getAllIds(eventProperties: EventProperty[]): string[] {
        var result: string[] = [];

        for (let eventProperty of eventProperties) {
            result.push(eventProperty.id);

            if (eventProperty instanceof EventPropertyNested) {
                result = result.concat(this.getAllIds((<EventPropertyNested> eventProperty).eventProperties));
            }
        }
        return result;
    }

    public getEventProperty(eventProperties: EventProperty[], id: string): EventProperty {
        var result: EventProperty = null;

        for (let eventProperty of eventProperties) {

            if (eventProperty.id === id) {
                return eventProperty;
            } else {
                if (eventProperty instanceof EventPropertyNested) {
                    return this.getEventProperty((eventProperty as EventPropertyNested).eventProperties, id);
                }
            }
        }
        return result;
    }

    private getTimestampProperty(eventProperties: EventProperty[]): EventProperty {

        for (let eventProperty of eventProperties) {
            if (eventProperty.id.startsWith('http://eventProperty.de/timestamp/')) {
                return eventProperty;
            }

            if (eventProperty instanceof EventPropertyNested) {
                let result = this.getTimestampProperty(eventProperty.eventProperties);

                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    private getStaticValueProperties(eventProperties: EventProperty[]): EventProperty[] {
        var result = [];

         for (let eventProperty of eventProperties) {
            if (eventProperty.id.startsWith('http://eventProperty.de/staticValue/')) {
                return [eventProperty];
            }

            if (eventProperty instanceof EventPropertyNested) {
                let tmpResult  = this.getStaticValueProperties(eventProperty.eventProperties);
                if (tmpResult.length > 0) {
                    result = result.concat(tmpResult);
                }
            }
        }

        return result;
    }

    public getTimestampTransformRules(newEventProperties: EventProperty[],
                                 oldEventSchema: EventSchema,
                                 newEventSchema: EventSchema): TimestampTransformationRuleDescription[] {
        var result: TimestampTransformationRuleDescription[] = [];

        for (let eventProperty of newEventProperties) {

            if (eventProperty instanceof EventPropertyPrimitive) {
                const eventPropertyPrimitive = eventProperty as EventPropertyPrimitive;
                const keyNew = this.getCompleteRuntimeNameKey(newEventSchema.eventProperties, eventPropertyPrimitive.id);

                if (eventProperty.isTimestampProperty()) {
                    result.push(new TimestampTransformationRuleDescription(
                        keyNew,
                        eventProperty.timestampTransformationMode,
                        eventProperty.timestampTransformationFormatString,
                        eventProperty.timestampTransformationMultiplier));
                }
            } else if (eventProperty instanceof EventPropertyNested) {
                const tmpResults: TimestampTransformationRuleDescription[] =
                    this.getTimestampTransformRules((<EventPropertyNested> eventProperty).eventProperties,  oldEventSchema, newEventSchema);
                result = result.concat(tmpResults);
            }


        }

        var filteredResult: TimestampTransformationRuleDescription[] = [];
        for (let res of result) {
            // TODO: better solution to check if the mode is valid
            if (res.mode === TimestampTransformationRuleMode.FORMAT_STRING
                || (res.multiplier != 0 && res.mode === TimestampTransformationRuleMode.TIME_UNIT))
                 {
                filteredResult.push(res);
            }
        }

        return filteredResult;


    }
}
